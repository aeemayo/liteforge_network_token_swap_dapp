// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LiteforgeSwap
 * @notice Decentralized exchange for swapping tokens on the Liteforge network
 * @dev Implements automated market maker (AMM) with constant product formula (x * y = k)
 */
contract LiteforgeSwap {
    // State variables
    address public owner;
    uint256 public totalLiquidity;
    uint256 public feePercentage = 30; // 0.3% fee (30 basis points)
    
    // Liquidity provider tracking
    mapping(address => uint256) public liquidityBalance;
    
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
     * @notice Contract constructor
     */
    constructor() {
        owner = msg.sender;
        locked = false;
    }
    
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
    
    /**
     * @notice Add liquidity to a token pair
     * @param tokenA Address of first token
     * @param tokenB Address of second token
     * @param amountA Amount of first token
     * @param amountB Amount of second token
     * @return liquidity Amount of liquidity tokens minted
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    ) external nonReentrant returns (uint256 liquidity) {
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Token not supported");
        require(tokenA != tokenB, "Cannot add liquidity for same token");
        require(amountA > 0 && amountB > 0, "Amounts must be greater than 0");
        
        // Order tokens consistently
        if (tokenA > tokenB) {
            (tokenA, tokenB) = (tokenB, tokenA);
            (amountA, amountB) = (amountB, amountA);
        }
        
        uint256 reserveA = reserves[tokenA][tokenB];
        uint256 reserveB = reserves[tokenB][tokenA];
        
        if (reserveA == 0 && reserveB == 0) {
            // First liquidity provider
            liquidity = sqrt(amountA * amountB);
        } else {
            // Subsequent liquidity providers must maintain ratio
            uint256 liquidityA = (amountA * totalLiquidity) / reserveA;
            uint256 liquidityB = (amountB * totalLiquidity) / reserveB;
            liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
        }
        
        require(liquidity > 0, "Insufficient liquidity minted");
        
        // Update reserves
        reserves[tokenA][tokenB] += amountA;
        reserves[tokenB][tokenA] += amountB;
        
        // Update liquidity tracking
        liquidityBalance[msg.sender] += liquidity;
        totalLiquidity += liquidity;
        
        emit LiquidityAdded(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
    }
    
    /**
     * @notice Remove liquidity from a token pair
     * @param tokenA Address of first token
     * @param tokenB Address of second token
     * @param liquidity Amount of liquidity tokens to burn
     * @return amountA Amount of first token returned
     * @return amountB Amount of second token returned
     */
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity
    ) external nonReentrant returns (uint256 amountA, uint256 amountB) {
        require(liquidity > 0, "Liquidity must be greater than 0");
        require(liquidityBalance[msg.sender] >= liquidity, "Insufficient liquidity balance");
        
        // Order tokens consistently
        if (tokenA > tokenB) {
            (tokenA, tokenB) = (tokenB, tokenA);
        }
        
        uint256 reserveA = reserves[tokenA][tokenB];
        uint256 reserveB = reserves[tokenB][tokenA];
        
        require(reserveA > 0 && reserveB > 0, "No liquidity in pool");
        
        // Calculate amounts to return
        amountA = (liquidity * reserveA) / totalLiquidity;
        amountB = (liquidity * reserveB) / totalLiquidity;
        
        require(amountA > 0 && amountB > 0, "Insufficient liquidity burned");
        
        // Update reserves
        reserves[tokenA][tokenB] -= amountA;
        reserves[tokenB][tokenA] -= amountB;
        
        // Update liquidity tracking
        liquidityBalance[msg.sender] -= liquidity;
        totalLiquidity -= liquidity;
        
        emit LiquidityRemoved(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
    }
    
    /**
     * @notice Swap tokens using constant product formula
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param amountIn Amount of input token
     * @return amountOut Amount of output token received
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external nonReentrant returns (uint256 amountOut) {
        require(supportedTokens[tokenIn] && supportedTokens[tokenOut], "Token not supported");
        require(tokenIn != tokenOut, "Cannot swap same token");
        require(amountIn > 0, "Amount must be greater than 0");
        
        uint256 reserveIn = reserves[tokenIn][tokenOut];
        uint256 reserveOut = reserves[tokenOut][tokenIn];
        
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        
        // Calculate fee
        uint256 amountInWithFee = amountIn * (10000 - feePercentage);
        uint256 fee = amountIn * feePercentage / 10000;
        
        // Calculate output amount using constant product formula: x * y = k
        // amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * 10000 + amountInWithFee);
        
        require(amountOut > 0, "Insufficient output amount");
        require(amountOut < reserveOut, "Insufficient liquidity for swap");
        
        // Update reserves
        reserves[tokenIn][tokenOut] += amountIn;
        reserves[tokenOut][tokenIn] -= amountOut;
        
        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut, fee);
    }
    
    /**
     * @notice Get quote for swap
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param amountIn Amount of input token
     * @return amountOut Estimated amount of output token
     * @return fee Fee amount
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
     * @param tokenA Address of first token
     * @param tokenB Address of second token
     * @return reserveA Reserve of first token
     * @return reserveB Reserve of second token
     */
    function getReserves(address tokenA, address tokenB) 
        external 
        view 
        returns (uint256 reserveA, uint256 reserveB) 
    {
        reserveA = reserves[tokenA][tokenB];
        reserveB = reserves[tokenB][tokenA];
    }
    
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
     * @param x Input value
     * @return y Square root of x
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
