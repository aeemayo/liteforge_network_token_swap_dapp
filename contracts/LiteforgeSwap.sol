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
     * @notice Swap tokens using constant product formula
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
        
        uint256 reserveIn = reserves[tokenIn][tokenOut];
        uint256 reserveOut = reserves[tokenOut][tokenIn];
        
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        
        uint256 amountInWithFee = receivedIn * (10000 - feePercentage);
        uint256 fee = (receivedIn * feePercentage) / 10000;
        
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * 10000 + amountInWithFee);
        
        require(amountOut > 0, "Insufficient output amount");
        require(amountOut < reserveOut, "Insufficient liquidity for swap");
        require(amountOut >= minAmountOut, "Slippage exceeded");

        // CEI: Update reserves before pushing output
        reserves[tokenIn][tokenOut] += receivedIn;
        reserves[tokenOut][tokenIn] -= amountOut;

        // Push output
        _pushTokens(tokenOut, msg.sender, amountOut);
        
        emit Swap(msg.sender, tokenIn, tokenOut, receivedIn, amountOut, fee);
    }
    
    // ── Quotes & views ──────────────────────────────────────────────

    /**
     * @notice Get quote for swap (pure read — no msg.value needed)
     */
    function getSwapQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut, uint256 fee) {
        require(supportedTokens[tokenIn] && supportedTokens[tokenOut], "Token not supported");
        require(amountIn > 0, "Amount must be greater than 0");
        
        uint256 reserveIn = reserves[tokenIn][tokenOut];
        uint256 reserveOut = reserves[tokenOut][tokenIn];
        
        if (reserveIn == 0 || reserveOut == 0) {
            return (0, 0);
        }
        
        fee = amountIn * feePercentage / 10000;
        uint256 amountInWithFee = amountIn * (10000 - feePercentage);
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * 10000 + amountInWithFee);
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
