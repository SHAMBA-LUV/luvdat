// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

/*
 * ❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️ SHAMBA LUV ❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️
 * 📊 TOTAL SUPPLY: 100000000000000000.000000000000000000 SHAMBA LUV
 *                        100 Quadrillion SHAMBA LUV
 * 
 * 💰 FEE STRUCTURE (5% Total):
 *    • 3% Reflection Fee - hold ❤️ to 💰 ❤️ 
 *    • 1% Liquidity Fee - ❤️ grows
 *    • 1% Team Fee - marketing and project management
 *    • share the ❤️ fee-free wallet-to-wallet transfers
 * 
 * 🔒 MAX TRANSFER: 1% of total supply
 * 🔒 FEES can only be lowered
 * 🔒 contract owner renounces to admin
 * 
 * 💎💎💎💎💎💎💎💎💎💎💎💎💎💎💎💎 HOLD LUV EARN LUV 💎💎💎💎💎💎💎💎💎💎💎💎💎💎💎💎💎
 */
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";



// Uniswap V3 interfaces for upgradeability
interface IUniswapV3SwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
    function exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn);
}

// Uniswap V2 Interface
interface IUniswapV2Router02 {
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
}

/**
 * @title SHAMBA LUV - Multi-Chain Reflection Token with Wallet-to-Wallet Fee Exemption
 * @dev Optimized for AggLayer deployment
 * @notice No trading pause - focuses on gas efficiency and legitimate admin functions
 * @notice Ready for Uniswap V3 expansion — not implemented by default
 * @notice IMPLEMENTED: Reflection distribution to token holders with GAS OPTIMIZATION
 * @notice Wallet-to-wallet transfers are fee-free share the LUV
 */
contract SHAMBALUV is ERC20, Ownable, ReentrancyGuard {
    using Address for address payable;

    // ============ CONSTANTS ============
    uint256 public constant TOTAL_SUPPLY = 100_000_000_000_000_000 * 1e18; // 100 Quadrillion
    uint256 public constant BASE_REFLECTION_FEE = 300;  // 3.00%
    uint256 public constant BASE_LIQUIDITY_FEE = 100;   // 1.00%
    uint256 public constant BASE_TEAM_FEE = 100;        // 1.00%
    uint256 public constant FEE_DENOMINATOR = 10000;    // precision
    uint256 public constant TOTAL_FEE_PERCENTAGE = BASE_REFLECTION_FEE + BASE_LIQUIDITY_FEE + BASE_TEAM_FEE;
    
    // Gas optimization constants
    uint256 public constant REFLECTION_BATCH_THRESHOLD = 1_000_000_000_000 * 1e18; // 1 trillion
    uint256 public constant REFLECTION_DENOMINATOR = 1e18;
    
    // Router management - unlimited approval is safe with proper threshold
    uint256 public constant MAX_THRESHOLD = TOTAL_SUPPLY / 50; // Max 2% for any threshold
    
    // ============ QUICKSWAP ROUTER ADDRESSES (POLYGON) ============
    address public constant QUICKSWAP_V2_ROUTER = 0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff; // QuickSwap V2 Router
    address public constant QUICKSWAP_V3_ROUTER = 0xF5B509Bb0909A69B1c207e495F687a6C0eE0989e; // QuickSwap V3 Router
    address public constant WPOL = 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270; // WMATIC (Polygon's WETH)
    
    // ============ STATE VARIABLES ============
    uint256 public teamSwapThreshold = 1_000_000_000_000 * 1e18; // 1 trillion tokens
    uint256 public swapThreshold = 500_000_000_000 * 1e18; // 500 billion tokens for swap trigger
    uint256 public liquidityThreshold = 1_000_000_000_000 * 1e18; // 1 trillion tokens
    uint256 public maxTransferAmount = TOTAL_SUPPLY / 100; // 1% of total supply can only be raise
    bool public maxTransferEnabled = true; // Toggle for max transfer protection on and off

    address public teamWallet;
    address public liquidityWallet; // exempt from reflection rewards
    address public adminWallet;     // exempt from max transfer to create liquidity
    address public pendingAdmin;    // separate admin duty following owner renounce
    bool public adminFinalized;     // owner sets admin one time and one time only

    // Router management - V2 default, V3 upgradeable admin duty
    IUniswapV2Router02 public router; // default router
    IUniswapV3SwapRouter public v3Router; // Optional V3 router
    address public constant WETH = WPOL; // gas optimized constant
    uint256 public lastRouterUpdateTime; // router diagnostic
    uint256 public routerUpdateCount; // show update count
    bool public useV3Router = false; // Toggle between V2 and V3

    // Swap management - trade cannot be paused
    bool public swapEnabled = true;
    bool private inSwap;

    // Wallet-to-wallet fee exemption
    /// @notice Enables or disables 0-fee transfers between EOAs (externally owned accounts)
    bool public walletToWalletFeeExempt = true;

    // Exemptions
    mapping(address => bool) public isExcludedFromFee; // all holders excluded from internal fee
    mapping(address => bool) public isExcludedFromMaxTransfer; // exclude owner
    mapping(address => bool) public isExcludedFromReflection;  // exclude liquidity

    // ============ REFLECTION VARIABLES (GAS OPTIMIZED) ============
    uint256 public reflectionThreshold = 1_000_000_000_000 * 1e18; // 1 trillion tokens
    uint256 public totalReflectionFeesCollected;    // total reflections collected
    uint256 public totalReflectionFeesDistributed;  // total reflections distributed
    uint256 public reflectionIndex; 
    mapping(address => uint256) public lastReflectionIndex;
    mapping(address => uint256) public reflectionBalance;
    
    // Gas optimization: Local total supply tracking
    uint256 private _localTotalSupply;
    
    // Gas optimization: Batch reflection processing
    uint256 public accumulatedReflectionFees;
    uint256 public reflectionBatchThreshold = REFLECTION_BATCH_THRESHOLD;

    // ============ EVENTS ============
    event RouterUpdated(address indexed oldRouter, address indexed newRouter);
    event V3RouterUpdated(address indexed oldV3Router, address indexed newV3Router);
    event RouterVersionToggled(bool useV3);
    event ThresholdsUpdated(uint256 teamThreshold, uint256 liquidityThreshold);
    event MaxTransferUpdated(uint256 oldMax, uint256 newMax);
    event MaxTransferToggled(bool enabled);
    event WalletUpdated(string walletType, address indexed oldWallet, address indexed newWallet);
    event FeeExemptionUpdated(address indexed account, bool status);
    event MaxTransferExemptionUpdated(address indexed account, bool status);
    event ReflectionExemptionUpdated(address indexed account, bool status);
    event SwapEnabledUpdated(bool enabled);
    event EmergencyThresholdUpdate(uint256 oldThreshold, uint256 newThreshold, address indexed by);
    event AdminUpdated(address indexed previousAdmin, address indexed newAdmin);
    event AdminTransferInitiated(address indexed pendingAdmin);
    event AdminRenounced(address indexed oldAdmin, uint256 timestamp);
    event ReflectionDistributed(address indexed holder, uint256 amount);
    event ReflectionThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event ReflectionBatchProcessed(uint256 totalFees, uint256 newIndex);
    event GasOptimizationStats(uint256 localTotalSupply, uint256 accumulatedFees);
    
    // Burn events
    event TokensBurned(address indexed burner, uint256 amount, address indexed deadAddress);
    
    // wallet-to-wallet fee exemption
    /// @notice Emitted when a wallet-to-wallet (EOA) transfer occurs with 0% fees
    event WalletToWalletFeeExemptTransfer(address indexed from, address indexed to, uint256 amount);
    event WalletToWalletFeeExemptToggled(bool enabled);

    // ============ MODIFIERS ============
    modifier swapping() {
        inSwap = true;
        _;
        inSwap = false;
    }

    modifier onlyAdmin() {
        require(msg.sender == adminWallet, "Not admin");
        _;
    }

    // ============ CONSTRUCTOR ============
    /**
     * @dev Constructor for LUV token
     * @param _teamWallet Address for team fee collection
     * @param _liquidityWallet Address for liquidity fee collection
     * @param _router Router address (use QUICKSWAP_V2_ROUTER for Polygon deployment)
     * 
     * For Polygon deployment, use: QUICKSWAP_V2_ROUTER = 0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff
     * Team will receive WPOL from trading activity
     */
    constructor(
        address _teamWallet,
        address _liquidityWallet,
        address _router
    ) ERC20("SHAMBA LUV", "LUV") {
        require(_teamWallet != address(0), "Invalid team wallet");
        require(_liquidityWallet != address(0), "Invalid liquidity wallet");
        require(_router != address(0), "Invalid router");
        
        teamWallet = _teamWallet;
        liquidityWallet = _liquidityWallet;
        router = IUniswapV2Router02(_router);
        
        // Exclude owner and liquidity wallet from fees and max transfer
        isExcludedFromFee[msg.sender] = true;
        isExcludedFromMaxTransfer[msg.sender] = true;
        isExcludedFromReflection[liquidityWallet] = true;
        
        // Mint total supply to owner
        _mint(msg.sender, TOTAL_SUPPLY);
        _localTotalSupply = TOTAL_SUPPLY;
    }

    /**
     * @dev Set initial exemptions for owner and contract
     */
    function _setInitialExemptions() private {
        // Max transfer exemptions
        isExcludedFromMaxTransfer[msg.sender] = true; // Only owner is exempt from max transfer
        isExcludedFromMaxTransfer[address(this)] = true;
        isExcludedFromMaxTransfer[liquidityWallet] = true;
        isExcludedFromMaxTransfer[adminWallet] = true;
    
        // Reflection exemptions - ONLY liquidity wallet
        isExcludedFromReflection[liquidityWallet] = true;
    }

    // ============ RECEIVE FUNCTION ============
    receive() external payable {}

    // ============ CORE FUNCTIONS ============
    
    /**
     * @dev Override _transfer with fee logic and reflection distribution - NO TRADING PAUSE
     * @dev GAS OPTIMIZED: Uses local total supply tracking and batch reflection processing
     * @dev ENHANCED: wallet-to-wallet transfers are fee-free
     */
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // Skip fee logic during construction (when from is zero address)
        if (from == address(0)) {
            super._transfer(from, to, amount);
            _localTotalSupply += amount; // Update local total supply
            return;
        }
        
        require(to != address(0), "Transfer to zero");
        require(amount > 0, "Transfer amount must be positive");

        // Max transfer check - only when enabled
        if (maxTransferEnabled && !isExcludedFromMaxTransfer[from] && !isExcludedFromMaxTransfer[to]) {
            require(amount <= maxTransferAmount, "Transfer exceeds max limit");
        }

        // ENHANCED: Wallet-to-wallet fee exemption logic
        bool isWalletToWallet = from.code.length == 0 && to.code.length == 0;
        if (
            isExcludedFromFee[from] ||
            isExcludedFromFee[to] ||
            (walletToWalletFeeExempt && isWalletToWallet)
        ) {
            super._transfer(from, to, amount);

            if (walletToWalletFeeExempt && isWalletToWallet) {
                emit WalletToWalletFeeExemptTransfer(from, to, amount);
            }

            return;
        }

        // Fee logic for non-exempt transfers (buying/selling)
        uint256 totalFee = (amount * TOTAL_FEE_PERCENTAGE) / FEE_DENOMINATOR;
        uint256 reflectionFee = (amount * BASE_REFLECTION_FEE) / FEE_DENOMINATOR;
        uint256 remaining = amount - totalFee;
        
        super._transfer(from, to, remaining);
        super._transfer(from, address(this), totalFee);
        
        // Gas optimization: Accumulate reflection fees for batch processing
        if (reflectionFee > 0) {
            accumulatedReflectionFees += reflectionFee;
            totalReflectionFeesCollected += reflectionFee;
            
            // Process reflections in batches for gas efficiency
            if (accumulatedReflectionFees >= reflectionBatchThreshold) {
                _processReflectionBatch();
            }
        }

        // Auto-swap logic - always enabled when swapEnabled is true
        if (swapEnabled && !inSwap && balanceOf(address(this)) >= swapThreshold) {
            _maybeSwapBack();
        }
    }

    /**
     * @dev Gas-optimized batch reflection processing
     * @dev Processes accumulated reflection fees in batches to reduce gas costs
     */
    function _processReflectionBatch() private {
        if (accumulatedReflectionFees == 0 || _localTotalSupply == 0) return;
        
        // Update reflection index with accumulated fees
        reflectionIndex += (accumulatedReflectionFees * REFLECTION_DENOMINATOR) / _localTotalSupply;
        
        emit ReflectionBatchProcessed(accumulatedReflectionFees, reflectionIndex);
        
        // Reset accumulated fees
        accumulatedReflectionFees = 0;
    }

    /**
     * @dev Force reflection update - can be called manually to process accumulated fees
     * @dev Useful for gas optimization when fees are below batch threshold
     */
    function forceReflectionUpdate() external {
        _processReflectionBatch();
    }

    /**
     * @dev Calculate and claim reflections for a holder
     * @dev GAS OPTIMIZED: Uses local total supply for calculations
     */
    function _claimReflections(address holder) private returns (uint256) {
        if (isExcludedFromReflection[holder]) {
            return 0;
        }

        // Process any pending batch first
        if (accumulatedReflectionFees > 0) {
            _processReflectionBatch();
        }

        uint256 currentReflectionIndex = reflectionIndex;
        uint256 lastIndex = lastReflectionIndex[holder];
        uint256 holderBalance = balanceOf(holder);
        
        if (holderBalance == 0 || currentReflectionIndex <= lastIndex) {
            return 0;
        }

        uint256 reflectionAmount;
        unchecked {
            uint256 delta = currentReflectionIndex - lastIndex;
            reflectionAmount = (holderBalance * delta) / REFLECTION_DENOMINATOR;
        }
        
        if (reflectionAmount > 0) {
            reflectionBalance[holder] += reflectionAmount;
            totalReflectionFeesDistributed += reflectionAmount;
        }
        
        lastReflectionIndex[holder] = currentReflectionIndex;
        
        return reflectionAmount;
    }

    /**
     * @dev Claim accumulated reflections for the caller
     */
    function claimReflections() external nonReentrant {
        require(!isExcludedFromReflection[msg.sender], "Exempt from reflections");
        uint256 amount = _claimReflections(msg.sender);
        require(amount > 0, "No reflections to claim");
        
        reflectionBalance[msg.sender] = 0;
        _transfer(address(this), msg.sender, amount);
        
        emit ReflectionDistributed(msg.sender, amount);
    }

    /**
     * @dev Get reflection balance for an address
     */
    function getReflectionBalance(address holder) external view returns (uint256) {
        if (isExcludedFromReflection[holder]) {
            return 0;
        }

        uint256 currentReflectionIndex = reflectionIndex;
        uint256 lastIndex = lastReflectionIndex[holder];
        uint256 holderBalance = balanceOf(holder);
        
        if (holderBalance == 0 || currentReflectionIndex <= lastIndex) {
            return reflectionBalance[holder];
        }

        uint256 reflectionAmount;
        unchecked {
            uint256 delta = currentReflectionIndex - lastIndex;
            reflectionAmount = (holderBalance * delta) / REFLECTION_DENOMINATOR;
        }
        return reflectionBalance[holder] + reflectionAmount;
    }

    // ============ SWAP FUNCTIONS ============
    
    /**
     * @dev Swap accumulated fees for ETH and tokens
     * @dev Always enabled when swapEnabled is true
     */
    function _maybeSwapBack() private swapping {
        uint256 contractBalance = balanceOf(address(this));
        
        if (contractBalance == 0) return;
        
        // Check thresholds
        bool shouldSwapTeam = contractBalance >= teamSwapThreshold;
        bool shouldSwapLiquidity = contractBalance >= liquidityThreshold;
        
        if (!shouldSwapTeam && !shouldSwapLiquidity) return;
        
        uint256 totalFee = BASE_LIQUIDITY_FEE + BASE_TEAM_FEE;
        uint256 swapAmount = (contractBalance * totalFee) / TOTAL_FEE_PERCENTAGE;
        
        if (swapAmount == 0) return;
        
        // Perform swap
        if (useV3Router && address(v3Router) != address(0)) {
            _swapBackV3(swapAmount);
        } else {
            _swapBackV2(swapAmount);
        }
    }

    /**
     * @dev Swap using Uniswap V2
     */
    function _swapBackV2(uint256 amount) private {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = WETH;
        
        uint256 beforeBalance = address(this).balance;
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amount,
            0,
            path,
            address(this),
            block.timestamp
        );
        uint256 received = address(this).balance - beforeBalance;
        require(received > 0, "No ETH received from swap");
        
        uint256 ethBalance = address(this).balance;
        uint256 totalFee = BASE_LIQUIDITY_FEE + BASE_TEAM_FEE;
        
        // Distribute ETH to team and liquidity wallets
        uint256 teamShare = (ethBalance * BASE_TEAM_FEE) / totalFee;
        uint256 liquidityShare = ethBalance - teamShare;
        
        if (teamShare > 0) {
            payable(teamWallet).sendValue(teamShare);
        }
        
        if (liquidityShare > 0) {
            payable(liquidityWallet).sendValue(liquidityShare);
        }
    }

    /**
     * @dev Swap using Uniswap V3
     */
    function _swapBackV3(uint256 amount) private {
        IUniswapV3SwapRouter.ExactInputSingleParams memory params = IUniswapV3SwapRouter.ExactInputSingleParams({
            tokenIn: address(this),
            tokenOut: WETH,
            fee: 3000, // 0.3% fee tier
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amount,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        uint256 amountOut = v3Router.exactInputSingle(params);
        uint256 totalFee = BASE_LIQUIDITY_FEE + BASE_TEAM_FEE;
        
        // Distribute ETH to team and liquidity wallets
        uint256 teamShare = (amountOut * BASE_TEAM_FEE) / totalFee;
        uint256 liquidityShare = amountOut - teamShare;
        
        if (teamShare > 0) {
            payable(teamWallet).sendValue(teamShare);
        }
        
        if (liquidityShare > 0) {
            payable(liquidityWallet).sendValue(liquidityShare);
        }
    }

    // ============ WALLET-TO-WALLET FEE EXEMPTION ============
    
    /**
     * @dev Toggle wallet-to-wallet fee exemption
     * @dev ENHANCED: Owner can control wallet-to-wallet fee exemption
     */
    function setWalletToWalletFeeExempt(bool _exempt) external onlyOwner {
        walletToWalletFeeExempt = _exempt;
        emit WalletToWalletFeeExemptToggled(_exempt);
    }

    // ============ ADMIN WALLET MANAGEMENT ============
    
    function setAdmin(address newAdmin) external onlyOwner {
        require(!adminFinalized, "Admin change already finalized");
        require(newAdmin != address(0), "Zero address");
        require(newAdmin != adminWallet, "Same admin address");
    
        address oldAdmin = adminWallet;
        adminWallet = newAdmin;
        pendingAdmin = address(0); // Clear any pending admin
    
        emit AdminUpdated(oldAdmin, newAdmin);
    }

    /**
     * @dev Change admin by current admin - admin can change admin after finalization
     * @dev admin can renounce
     */
    function changeAdminByAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Zero address");
        emit AdminUpdated(adminWallet, newAdmin);
        adminWallet = newAdmin;
    }
    
    // ============ ROUTER MANAGEMENT ============
    
    /**
     * @dev Update V2 router for multi-chain deployment (e.g., AggLayer)
     */
    function updateRouter(address _newRouter) external onlyAdmin {
        require(_newRouter != address(0), "Zero address");
        require(_newRouter != address(router), "Already set");
        
        address oldRouter = address(router);
        router = IUniswapV2Router02(_newRouter);
        
        // Revoke old approval and set new one
        _approve(address(this), oldRouter, 0);
        _approve(address(this), address(router), type(uint256).max);
        
        lastRouterUpdateTime = block.timestamp;
        routerUpdateCount++;
        
        emit RouterUpdated(oldRouter, _newRouter);
    }

    /**
     * @dev Set V3 router for upgradeability
     */
    function setV3Router(address _v3Router) external onlyAdmin {
        address oldV3Router = address(v3Router);
        v3Router = IUniswapV3SwapRouter(_v3Router);
        
        emit V3RouterUpdated(oldV3Router, _v3Router);
    }

    /**
     * @dev Convenience function to set up QuickSwap V3 router
     * @dev Use this after deployment to enable V3 functionality
     */
    function setupQuickSwapV3() external onlyAdmin {
        v3Router = IUniswapV3SwapRouter(QUICKSWAP_V3_ROUTER);
        emit V3RouterUpdated(address(0), QUICKSWAP_V3_ROUTER);
    }

    /**
     * @dev Toggle between V2 and V3 router usage
     */
    function toggleRouterVersion() external onlyAdmin {
        require(address(v3Router) != address(0), "V3 router not set");
        useV3Router = !useV3Router;
        
        emit RouterVersionToggled(useV3Router);
    }

    /**
     * @dev Get current router configuration
     */
    function getRouterConfig() external view returns (
        address v2Router,
        address v3RouterAddress,
        bool usingV3,
        uint256 lastUpdate,
        uint256 updateCount
    ) {
        return (
            address(router),
            address(v3Router),
            useV3Router,
            lastRouterUpdateTime,
            routerUpdateCount
        );
    }

    // ============ threshold CONTROLS ============
    
    /**
     * @dev Emergency threshold adjustment - legitimate use case
     * allow increasing threshold to prevent rapid fee collection
     */
    function emergencyIncreaseThresholds(
        uint256 _newTeamThreshold,
        uint256 _newLiquidityThreshold
    ) external onlyAdmin {
        require(_newTeamThreshold >= teamSwapThreshold, "Can only increase");
        require(_newLiquidityThreshold >= liquidityThreshold, "Can only increase");
        require(_newTeamThreshold <= MAX_THRESHOLD, "Exceeds max threshold");
        require(_newLiquidityThreshold <= MAX_THRESHOLD, "Exceeds max threshold");
        
        uint256 oldTeamThreshold = teamSwapThreshold;
        uint256 oldLiquidityThreshold = liquidityThreshold;
        
        teamSwapThreshold = _newTeamThreshold;
        liquidityThreshold = _newLiquidityThreshold;
        
        emit EmergencyThresholdUpdate(oldTeamThreshold, _newTeamThreshold, msg.sender);
        emit EmergencyThresholdUpdate(oldLiquidityThreshold, _newLiquidityThreshold, msg.sender);
    }

    // ============ OWNER FUNCTIONS ============
    
    /**
     * @dev Set thresholds for team and liquidity swaps
     */
    function setThresholds(uint256 _teamThreshold, uint256 _liquidityThreshold) external onlyOwner {
        require(_teamThreshold <= MAX_THRESHOLD, "Exceeds max threshold");
        require(_liquidityThreshold <= MAX_THRESHOLD, "Exceeds max threshold");
        
        teamSwapThreshold = _teamThreshold;
        liquidityThreshold = _liquidityThreshold;
        
        emit ThresholdsUpdated(_teamThreshold, _liquidityThreshold);
    }

    /**
     * @dev Update max transfer amount - can only be increased for security
     */
    function setMaxTransferAmount(uint256 _newMax) external onlyOwner {
        require(_newMax >= maxTransferAmount, "Cannot reduce max transfer");
        require(_newMax >= TOTAL_SUPPLY / 100, "Cannot set below 1% of total supply");
        require(_newMax > 0, "Max transfer must be positive");
        
        uint256 oldMax = maxTransferAmount;
        maxTransferAmount = _newMax;
        
        emit MaxTransferUpdated(oldMax, _newMax);
    }

    /**
     * @dev Toggle max transfer protection on/off
     */
    function setMaxTransferEnabled(bool _enabled) external onlyOwner {
        maxTransferEnabled = _enabled;
        emit MaxTransferToggled(_enabled);
    }

    /**
     * @dev Update wallets with validation
     */
    function setTeamWallet(address _teamWallet) external onlyOwner {
        require(_teamWallet != address(0), "Zero address");
        
        address oldWallet = teamWallet;
        teamWallet = _teamWallet;
        
        emit WalletUpdated("team", oldWallet, _teamWallet);
    }

    function setLiquidityWallet(address _liqWallet) external onlyOwner {
        require(_liqWallet != address(0), "Zero address");
        
        address oldWallet = liquidityWallet;
        liquidityWallet = _liqWallet;
        
        emit WalletUpdated("liquidity", oldWallet, _liqWallet);
    }

    // ============ EXEMPTION MANAGEMENT ============
    
    function setFeeExemption(address account, bool status) external onlyOwner {
        isExcludedFromFee[account] = status;
        emit FeeExemptionUpdated(account, status);
    }
    
    // owner and liquidity must be max transfer exempt to create liquidity
    function setMaxTransferExemption(address account, bool status) external onlyOwner {
        isExcludedFromMaxTransfer[account] = status;
        emit MaxTransferExemptionUpdated(account, status);
    }

    // set liquidity wallet as reflection exempt
    function setReflectionExemption(address account, bool status) external onlyOwner {
        isExcludedFromReflection[account] = status;
        emit ReflectionExemptionUpdated(account, status);
    }

    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get current fee percentage
     */
    function getFeePercentage() external pure returns (uint256) {
        return TOTAL_FEE_PERCENTAGE;
    }

    /**
     * @dev Get router status
     */
    function getRouterStatus() external view returns (
        address routerAddress,
        uint256 lastUpdate,
        uint256 updateCount
    ) {
        return (
            address(router),
            lastRouterUpdateTime,
            routerUpdateCount
        );
    }

    /**
     * @dev Get swap status (swaps are always enabled)
     */
    function getSwapStatus() external view returns (
        bool enabled,
        uint256 teamThreshold,
        uint256 liquidityThresholdValue,
        uint256 contractBalance
    ) {
        return (
            swapEnabled, // Swaps are always enabled
            teamSwapThreshold,
            liquidityThreshold,
            balanceOf(address(this))
        );
    }

    /**
     * @dev Get reflection statistics
     */
    function getReflectionStats() external view returns (
        uint256 totalCollected,
        uint256 totalDistributed,
        uint256 currentIndex,
        uint256 threshold,
        uint256 accumulated,
        uint256 batchThreshold
    ) {
        return (
            totalReflectionFeesCollected,
            totalReflectionFeesDistributed,
            reflectionIndex,
            reflectionThreshold,
            accumulatedReflectionFees,
            reflectionBatchThreshold
        );
    }

    /**
     * @dev Get gas optimization statistics
     */
    function getGasOptimizationStats() external view returns (
        uint256 localTotalSupply,
        uint256 accumulatedFees,
        uint256 batchThreshold,
        uint256 reflectionDenominator
    ) {
        return (
            _localTotalSupply,
            accumulatedReflectionFees,
            reflectionBatchThreshold,
            REFLECTION_DENOMINATOR
        );
    }

    /**
     * @dev Get wallet-to-wallet fee exemption status
     * @dev ENHANCED: Added status check for wallet-to-wallet fee exemption
     */
    function getWalletToWalletFeeExemptStatus() external view returns (
        bool enabled,
        string memory description
    ) {
        return (
            walletToWalletFeeExempt,
            walletToWalletFeeExempt ? 
                "Wallet-to-wallet transfers are fee-free" : 
                "All transfers are subject to fees"
        );
    }

    /**
     * @dev Get current WETH address (WPOL on Polygon)
     */
    function getCurrentWETHAddress() external pure returns (address) {
        return WETH;
    }

    // ============ BURN FUNCTIONS ============
    
    /**
     * @dev Manual burn function for team to burn tokens to dead address
     * @param amount Amount of tokens to burn
     * @notice Only owner can call this function
     * @notice Tokens are sent to dead address (0x000000000000000000000000000000000000dEaD)
     * @notice This reduces the total supply permanently
     */
    function manualBurn(uint256 amount) external onlyOwner {
        require(amount > 0, "Burn amount must be positive");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance to burn");
        
        // Dead address constant
        address deadAddress = 0x000000000000000000000000000000000000dEaD;
        
        // Transfer tokens to dead address (permanent burn)
        _transfer(msg.sender, deadAddress, amount);
        
        // Update local total supply for reflection calculations
        _localTotalSupply -= amount;
        
        emit TokensBurned(msg.sender, amount, deadAddress);
    }
    
    /**
     * @dev Burn tokens from contract balance to dead address
     * @param amount Amount of tokens to burn from contract
     * @notice Only owner can call this function
     * @notice Burns tokens from contract's accumulated fee balance
     */
    function burnFromContract(uint256 amount) external onlyOwner {
        require(amount > 0, "Burn amount must be positive");
        require(balanceOf(address(this)) >= amount, "Insufficient contract balance");
        
        // Dead address constant
        address deadAddress = 0x000000000000000000000000000000000000dEaD;
        
        // Transfer tokens from contract to dead address
        _transfer(address(this), deadAddress, amount);
        
        // Update local total supply for reflection calculations
        _localTotalSupply -= amount;
        
        emit TokensBurned(address(this), amount, deadAddress);
    }
    
    // ============ RENOUNCE FUNCTIONS ============
    
    /**
     * @dev Owner can renounce ownership
     */
    function renounceOwnership() public virtual override onlyOwner {
        _transferOwnership(address(0)); // Owner becomes address(0)
    }

    /**
     * @dev Admin can renounce admin role
     */
    function renounceAdminRole() external onlyAdmin {
        address oldAdmin = adminWallet;
        adminWallet = address(0);
        adminFinalized = true; // Prevent future admin changes
    
        emit AdminRenounced(oldAdmin, block.timestamp);
    }
} 