// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title LiteforgeSwap
 * @notice Decentralized exchange for swapping tokens on the Liteforge network
 * @dev Implements automated market maker (AMM) with constant product formula (x * y = k)
 *      AND fixed-rate swaps for zkLTC pairs. When a fixed rate is configured for a token,
 *      all swaps between that token and zkLTC use the fixed rate instead of the AMM formula.
 *      Supports native zkLTC swaps via a sentinel address.
 */
contract LiteforgeSwap {
    // Sentinel address representing the native token (zkLTC)
    address public constant NATIVE_TOKEN = address(1);

    // State variables
    address public owner;
    uint256 public feePercentage = 30; // 0.3% fee (30 basis points)
    
    // Liquidity provider tracking (pair-specific)
    mapping(address => mapping(address => mapping(address => uint256))) public liquidityBalance;
    mapping(address => mapping(address => uint256)) public totalLiquidity;
    
    // Token pair reserves
    mapping(address => mapping(address => uint256)) public reserves;
    
    // Supported tokens
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;

    // ── Fixed-rate configuration for zkLTC pairs ────────────────────
    // fixedRate[token] = how many zkLTC wei per 1 full token (scaled to 18 decimals).
    // A rate of 0 means no fixed rate is set → fall back to AMM.
    // Example: if 1 TOKEN = 0.5 zkLTC, set fixedRate[token] = 0.5e18 = 500000000000000000
    mapping(address => uint256) public fixedRate;

    // Track which tokens have fixed rates for enumeration
    address[] public fixedRateTokens;
    mapping(address => bool) public hasFixedRate;
    
    // Events
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    
    event LiquidityAdded(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );
    
    event LiquidityRemoved(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );
    
    event TokenAdded(address indexed token, string symbol);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FixedRateSet(address indexed token, uint256 rate);
    event FixedRateRemoved(address indexed token);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier nonReentrant() {
        require(!locked, "Reentrancy detected");
        locked = true;
        _;
        locked = false;
    }
    
    bool private locked;
    
    /**
     * @notice Contract constructor — registers native token automatically
     */
    constructor() {
        owner = msg.sender;
        locked = false;

        // Auto-register the native token so it is always available
        supportedTokens[NATIVE_TOKEN] = true;
        tokenList.push(NATIVE_TOKEN);
        emit TokenAdded(NATIVE_TOKEN, "zkLTC");
    }

    /// @notice Accept plain native-token transfers (e.g. for liquidity)
    receive() external payable {}
    
    // ── Internal helpers for native / ERC-20 transfers ──────────────

    function _isNative(address token) internal pure returns (bool) {
        return token == NATIVE_TOKEN;
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "ERC-20 transfer failed");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "ERC-20 transferFrom failed");
    }

    function _pullTokensAndGetReceived(address token, address from, uint256 amount) internal returns (uint256) {
        if (_isNative(token)) {
            require(msg.value == amount, "Native amount mismatch");
            return amount;
        } else {
            uint256 balanceBefore = IERC20(token).balanceOf(address(this));
            _safeTransferFrom(token, from, address(this), amount);
            return IERC20(token).balanceOf(address(this)) - balanceBefore;
        }
    }

    function _pushTokens(address token, address to, uint256 amount) internal {
        if (_isNative(token)) {
            (bool sent, ) = payable(to).call{value: amount}("");
            require(sent, "Native transfer failed");
        } else {
            _safeTransfer(token, to, amount);
        }
    }

    // ── Fixed-rate helpers ──────────────────────────────────────────

    /**
     * @dev Returns true if this swap pair involves native zkLTC on one side
     *      and a token with a fixed rate on the other side.
     */
    function _isFixedRatePair(address tokenIn, address tokenOut) internal view returns (bool) {
        if (_isNative(tokenIn) && fixedRate[tokenOut] > 0) return true;
        if (_isNative(tokenOut) && fixedRate[tokenIn] > 0) return true;
        return false;
    }

    /**
     * @dev Compute a fixed-rate swap output.
     *      fixedRate[token] = zkLTC wei per 1e18 token wei.
     *
     *      - Buying token with zkLTC:  amountOut = amountInAfterFee * 1e18 / rate
     *      - Selling token for zkLTC:  amountOut = amountInAfterFee * rate / 1e18
     */
    function _computeFixedRateOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256 amountOut, uint256 fee) {
        fee = (amountIn * feePercentage) / 10000;
        uint256 amountInAfterFee = amountIn - fee;

        if (_isNative(tokenIn)) {
            // zkLTC → Token: user sends zkLTC, receives token
            uint256 rate = fixedRate[tokenOut]; // zkLTC per 1 token
            require(rate > 0, "No fixed rate for this token");
            amountOut = (amountInAfterFee * 1e18) / rate;
        } else {
            // Token → zkLTC: user sends token, receives zkLTC
            uint256 rate = fixedRate[tokenIn]; // zkLTC per 1 token
            require(rate > 0, "No fixed rate for this token");
            amountOut = (amountInAfterFee * rate) / 1e18;
        }
    }

    // ── Token management ────────────────────────────────────────────

    /**
     * @notice Add a new supported token
     * @param token Address of the token to add
     * @param symbol Symbol of the token
     */
    function addSupportedToken(address token, string memory symbol) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!supportedTokens[token], "Token already supported");
        
        supportedTokens[token] = true;
        tokenList.push(token);
        
        emit TokenAdded(token, symbol);
    }
    
    /**
     * @notice Get all supported tokens
     * @return Array of token addresses
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }

    // ── Fixed-rate management ───────────────────────────────────────

    /**
     * @notice Set a fixed exchange rate for a token's zkLTC pair.
     * @param token  The ERC-20 token address (NOT the native token sentinel).
     * @param rate   zkLTC wei per 1 full token (1e18 units of the token).
     *               For example: 1 TOKEN = 2 zkLTC → rate = 2e18 = 2000000000000000000.
     *               Set to 0 to remove the fixed rate (reverts to AMM).
     */
    function setFixedRate(address token, uint256 rate) external onlyOwner {
        require(token != address(0) && token != NATIVE_TOKEN, "Cannot set rate for native token");
        require(supportedTokens[token], "Token not supported");

        if (rate == 0) {
            // Remove fixed rate
            fixedRate[token] = 0;
            if (hasFixedRate[token]) {
                hasFixedRate[token] = false;
                _removeFromFixedRateList(token);
            }
            emit FixedRateRemoved(token);
        } else {
            fixedRate[token] = rate;
            if (!hasFixedRate[token]) {
                hasFixedRate[token] = true;
                fixedRateTokens.push(token);
            }
            emit FixedRateSet(token, rate);
        }
    }

    /**
     * @notice Batch-set fixed rates for multiple tokens at once.
     * @param tokens Array of ERC-20 token addresses.
     * @param rates  Array of rates (zkLTC wei per 1e18 token).
     */
    function setFixedRateBatch(address[] calldata tokens, uint256[] calldata rates) external onlyOwner {
        require(tokens.length == rates.length, "Array length mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0) && tokens[i] != NATIVE_TOKEN, "Cannot set rate for native token");
            require(supportedTokens[tokens[i]], "Token not supported");

            if (rates[i] == 0) {
                fixedRate[tokens[i]] = 0;
                if (hasFixedRate[tokens[i]]) {
                    hasFixedRate[tokens[i]] = false;
                    _removeFromFixedRateList(tokens[i]);
                }
                emit FixedRateRemoved(tokens[i]);
            } else {
                fixedRate[tokens[i]] = rates[i];
                if (!hasFixedRate[tokens[i]]) {
                    hasFixedRate[tokens[i]] = true;
                    fixedRateTokens.push(tokens[i]);
                }
                emit FixedRateSet(tokens[i], rates[i]);
            }
        }
    }

    /**
     * @notice Get the fixed rate for a token (0 = no fixed rate / AMM mode).
     */
    function getFixedRate(address token) external view returns (uint256) {
        return fixedRate[token];
    }

    /**
     * @notice Get all tokens that currently have a fixed rate configured.
     */
    function getFixedRateTokens() external view returns (address[] memory) {
        return fixedRateTokens;
    }

    function _removeFromFixedRateList(address token) internal {
        uint256 len = fixedRateTokens.length;
        for (uint256 i = 0; i < len; i++) {
            if (fixedRateTokens[i] == token) {
                fixedRateTokens[i] = fixedRateTokens[len - 1];
                fixedRateTokens.pop();
                break;
            }
        }
    }
    
    // ── Liquidity ───────────────────────────────────────────────────

    /**
     * @notice Add liquidity to a token pair
     * @dev If one of the tokens is native, send the native amount as msg.value.
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    ) external payable nonReentrant returns (uint256 liquidity) {
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Token not supported");
        require(tokenA != tokenB, "Cannot add liquidity for same token");
        require(amountA > 0 && amountB > 0, "Amounts must be greater than 0");

        // Exactly one token may be native; validate msg.value accordingly
        if (_isNative(tokenA)) {
            require(msg.value == amountA, "Native amount mismatch for tokenA");
        } else if (_isNative(tokenB)) {
            require(msg.value == amountB, "Native amount mismatch for tokenB");
        } else {
            require(msg.value == 0, "No native value expected");
        }
        
        // Order tokens consistently
        if (tokenA > tokenB) {
            (tokenA, tokenB) = (tokenB, tokenA);
            (amountA, amountB) = (amountB, amountA);
        }
        
        uint256 receivedA = _pullTokensAndGetReceived(tokenA, msg.sender, amountA);
        uint256 receivedB = _pullTokensAndGetReceived(tokenB, msg.sender, amountB);
        
        uint256 reserveA = reserves[tokenA][tokenB];
        uint256 reserveB = reserves[tokenB][tokenA];
        
        uint256 _totalLiquidity = totalLiquidity[tokenA][tokenB];
        
        if (_totalLiquidity == 0) {
            liquidity = sqrt(receivedA * receivedB);
            require(liquidity > 1000, "Insufficient initial liquidity");
            liquidity -= 1000;
            totalLiquidity[tokenA][tokenB] += 1000; // Permanently lock minimum liquidity
        } else {
            uint256 liquidityA = (receivedA * _totalLiquidity) / reserveA;
            uint256 liquidityB = (receivedB * _totalLiquidity) / reserveB;
            liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
        }
        
        require(liquidity > 0, "Insufficient liquidity minted");

        // Update reserves
        reserves[tokenA][tokenB] += receivedA;
        reserves[tokenB][tokenA] += receivedB;
        
        // Update liquidity tracking
        liquidityBalance[tokenA][tokenB][msg.sender] += liquidity;
        totalLiquidity[tokenA][tokenB] += liquidity;
        
        emit LiquidityAdded(msg.sender, tokenA, tokenB, receivedA, receivedB, liquidity);
    }
    
    /**
     * @notice Remove liquidity from a token pair
     */
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity
    ) external nonReentrant returns (uint256 amountA, uint256 amountB) {
        require(liquidity > 0, "Liquidity must be greater than 0");
        
        address token0 = tokenA < tokenB ? tokenA : tokenB;
        address token1 = tokenA < tokenB ? tokenB : tokenA;
        
        require(liquidityBalance[token0][token1][msg.sender] >= liquidity, "Insufficient liquidity balance");
        
        uint256 reserve0 = reserves[token0][token1];
        uint256 reserve1 = reserves[token1][token0];
        uint256 _totalLiquidity = totalLiquidity[token0][token1];
        
        require(reserve0 > 0 && reserve1 > 0, "No liquidity in pool");
        
        uint256 amount0 = (liquidity * reserve0) / _totalLiquidity;
        uint256 amount1 = (liquidity * reserve1) / _totalLiquidity;
        
        require(amount0 > 0 && amount1 > 0, "Insufficient liquidity burned");
        
        // CEI: Update state before external calls
        reserves[token0][token1] -= amount0;
        reserves[token1][token0] -= amount1;
        liquidityBalance[token0][token1][msg.sender] -= liquidity;
        totalLiquidity[token0][token1] -= liquidity;

        _pushTokens(token0, msg.sender, amount0);
        _pushTokens(token1, msg.sender, amount1);
        
        amountA = tokenA == token0 ? amount0 : amount1;
        amountB = tokenA == token0 ? amount1 : amount0;
        
        emit LiquidityRemoved(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
    }
    
    // ── Swap ────────────────────────────────────────────────────────

    /**
     * @notice Swap tokens. If the pair has a fixed rate with zkLTC, uses the fixed rate.
     *         Otherwise falls back to constant product AMM formula.
     * @dev If tokenIn is native, send the exact amount as msg.value.
     *      If tokenIn is ERC-20, msg.value must be 0.
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external payable nonReentrant returns (uint256 amountOut) {
        require(supportedTokens[tokenIn] && supportedTokens[tokenOut], "Token not supported");
        require(tokenIn != tokenOut, "Cannot swap same token");
        require(amountIn > 0, "Amount must be greater than 0");

        if (_isNative(tokenIn)) {
            require(msg.value == amountIn, "Native amount mismatch");
        } else {
            require(msg.value == 0, "No native value expected for ERC-20 swap");
        }
        
        uint256 receivedIn = _pullTokensAndGetReceived(tokenIn, msg.sender, amountIn);
        uint256 fee;

        if (_isFixedRatePair(tokenIn, tokenOut)) {
            // ── Fixed-rate swap ──
            (amountOut, fee) = _computeFixedRateOutput(tokenIn, tokenOut, receivedIn);

            require(amountOut > 0, "Insufficient output amount");
            require(amountOut >= minAmountOut, "Slippage exceeded");

            // For fixed-rate swaps, ensure the contract holds enough of the output token
            if (_isNative(tokenOut)) {
                require(address(this).balance >= amountOut, "Insufficient contract zkLTC balance for fixed-rate swap");
            } else {
                require(IERC20(tokenOut).balanceOf(address(this)) >= amountOut, "Insufficient contract token balance for fixed-rate swap");
            }
        } else {
            // ── AMM swap (constant product) ──
            uint256 reserveIn = reserves[tokenIn][tokenOut];
            uint256 reserveOut = reserves[tokenOut][tokenIn];
            
            require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
            
            uint256 amountInWithFee = receivedIn * (10000 - feePercentage);
            fee = (receivedIn * feePercentage) / 10000;
            
            amountOut = (amountInWithFee * reserveOut) / (reserveIn * 10000 + amountInWithFee);
            
            require(amountOut > 0, "Insufficient output amount");
            require(amountOut < reserveOut, "Insufficient liquidity for swap");
            require(amountOut >= minAmountOut, "Slippage exceeded");

            // CEI: Update reserves before pushing output
            reserves[tokenIn][tokenOut] += receivedIn;
            reserves[tokenOut][tokenIn] -= amountOut;
        }

        // Push output
        _pushTokens(tokenOut, msg.sender, amountOut);
        
        emit Swap(msg.sender, tokenIn, tokenOut, receivedIn, amountOut, fee);
    }
    
    // ── Quotes & views ──────────────────────────────────────────────

    /**
     * @notice Get quote for swap (pure read — no msg.value needed).
     *         Uses fixed rate for zkLTC pairs when configured.
     */
    function getSwapQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut, uint256 fee) {
        require(supportedTokens[tokenIn] && supportedTokens[tokenOut], "Token not supported");
        require(amountIn > 0, "Amount must be greater than 0");

        if (_isFixedRatePair(tokenIn, tokenOut)) {
            (amountOut, fee) = _computeFixedRateOutput(tokenIn, tokenOut, amountIn);
        } else {
            uint256 reserveIn = reserves[tokenIn][tokenOut];
            uint256 reserveOut = reserves[tokenOut][tokenIn];
            
            if (reserveIn == 0 || reserveOut == 0) {
                return (0, 0);
            }
            
            fee = amountIn * feePercentage / 10000;
            uint256 amountInWithFee = amountIn * (10000 - feePercentage);
            amountOut = (amountInWithFee * reserveOut) / (reserveIn * 10000 + amountInWithFee);
        }
    }

    /**
     * @notice Check if a pair uses fixed-rate pricing.
     */
    function isFixedRatePair(address tokenIn, address tokenOut) external view returns (bool) {
        return _isFixedRatePair(tokenIn, tokenOut);
    }
    
    /**
     * @notice Get reserves for a token pair
     */
    function getReserves(address tokenA, address tokenB) 
        external 
        view 
        returns (uint256 reserveA, uint256 reserveB) 
    {
        reserveA = reserves[tokenA][tokenB];
        reserveB = reserves[tokenB][tokenA];
    }
    
    // ── Admin ───────────────────────────────────────────────────────

    /**
     * @notice Update fee percentage
     * @param newFee New fee in basis points (e.g., 30 = 0.3%)
     */
    function updateFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // Max 10%
        uint256 oldFee = feePercentage;
        feePercentage = newFee;
        emit FeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Owner can deposit native zkLTC to fund fixed-rate swaps
     */
    function depositNative() external payable onlyOwner {
        require(msg.value > 0, "Must send zkLTC");
    }

    /**
     * @notice Owner can withdraw native zkLTC (only surplus, not AMM reserves)
     */
    function withdrawNative(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(address(this).balance >= amount, "Insufficient balance");
        (bool sent, ) = payable(owner).call{value: amount}("");
        require(sent, "Transfer failed");
    }
    
    /**
     * @notice Calculate square root (Babylonian method)
     */
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
