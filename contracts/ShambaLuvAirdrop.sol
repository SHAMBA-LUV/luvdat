// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ShambaLuvAirdrop
 * @dev Flexible airdrop contract that can handle any ERC20 tokens
 * @notice Automatically gives tokens to new users who connect their wallet
 * @notice Supports multiple token types and emergency rescue functions
 */
contract ShambaLuvAirdrop is Ownable, ReentrancyGuard {
    // Default token for SHAMBA LUV airdrops
    IERC20 public immutable defaultToken;
    
    // Airdrop configuration per token
    struct AirdropConfig {
        uint256 amount;
        bool isActive;
        uint256 totalClaimed;
        uint256 totalRecipients;
    }
    
    // Token configurations
    mapping(address => AirdropConfig) public tokenConfigs;
    
    // Track who has already claimed per token
    mapping(address => mapping(address => bool)) public hasClaimed;
    
    // Events
    event AirdropClaimed(address indexed token, address indexed recipient, uint256 amount);
    event AirdropConfigUpdated(address indexed token, uint256 oldAmount, uint256 newAmount, bool isActive);
    event TokensDeposited(address indexed token, address indexed from, uint256 amount);
    event TokensWithdrawn(address indexed token, address indexed to, uint256 amount);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);
    
    constructor(address _defaultToken) {
        require(_defaultToken != address(0), "Invalid default token address");
        defaultToken = IERC20(_defaultToken);
        
        // Set default configuration for the main token
        tokenConfigs[_defaultToken] = AirdropConfig({
            amount: 1_000_000_000_000 * 1e18, // 1 trillion tokens
            isActive: true,
            totalClaimed: 0,
            totalRecipients: 0
        });
    }
    
    /**
     * @dev Claim airdrop tokens for the default token (one-time per address)
     */
    function claimAirdrop() external nonReentrant {
        claimAirdropForToken(address(defaultToken));
    }
    
    /**
     * @dev Claim airdrop tokens for a specific token (one-time per address per token)
     */
    function claimAirdropForToken(address token) public nonReentrant {
        require(token != address(0), "Invalid token address");
        require(!hasClaimed[token][msg.sender], "Already claimed for this token");
        
        AirdropConfig storage config = tokenConfigs[token];
        require(config.isActive, "Airdrop not active for this token");
        require(config.amount > 0, "Airdrop amount not set");
        
        // Check contract has enough tokens
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        require(contractBalance >= config.amount, "Insufficient tokens in contract");
        
        // Mark as claimed
        hasClaimed[token][msg.sender] = true;
        config.totalClaimed += config.amount;
        config.totalRecipients++;
        
        // Transfer tokens
        require(IERC20(token).transfer(msg.sender, config.amount), "Transfer failed");
        
        emit AirdropClaimed(token, msg.sender, config.amount);
    }
    
    /**
     * @dev Check if an address has already claimed for a specific token
     */
    function hasUserClaimed(address token, address user) external view returns (bool) {
        return hasClaimed[token][user];
    }
    
    /**
     * @dev Check if an address has already claimed for the default token
     */
    function hasUserClaimed(address user) external view returns (bool) {
        return hasClaimed[address(defaultToken)][user];
    }
    
    /**
     * @dev Get airdrop stats for a specific token
     */
    function getAirdropStats(address token) external view returns (
        uint256 airdropAmount,
        uint256 totalClaimed,
        uint256 totalRecipients,
        uint256 contractBalance,
        bool isActive
    ) {
        AirdropConfig storage config = tokenConfigs[token];
        return (
            config.amount,
            config.totalClaimed,
            config.totalRecipients,
            IERC20(token).balanceOf(address(this)),
            config.isActive
        );
    }
    
    /**
     * @dev Get airdrop stats for the default token
     */
    function getAirdropStats() external view returns (
        uint256 airdropAmount,
        uint256 totalClaimed,
        uint256 totalRecipients,
        uint256 contractBalance,
        bool isActive
    ) {
        return getAirdropStats(address(defaultToken));
    }
    
    /**
     * @dev Owner can set airdrop configuration for any token
     */
    function setAirdropConfig(address token, uint256 amount, bool isActive) external onlyOwner {
        require(token != address(0), "Invalid token address");
        
        AirdropConfig storage config = tokenConfigs[token];
        uint256 oldAmount = config.amount;
        
        config.amount = amount;
        config.isActive = isActive;
        
        emit AirdropConfigUpdated(token, oldAmount, amount, isActive);
    }
    
    /**
     * @dev Owner can update airdrop amount for the default token
     */
    function setAirdropAmount(uint256 _newAmount) external onlyOwner {
        setAirdropConfig(address(defaultToken), _newAmount, true);
    }
    
    /**
     * @dev Owner can deposit tokens to the contract
     */
    function depositTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit TokensDeposited(token, msg.sender, amount);
    }
    
    /**
     * @dev Owner can deposit default tokens to the contract
     */
    function depositTokens(uint256 amount) external onlyOwner {
        depositTokens(address(defaultToken), amount);
    }
    
    /**
     * @dev Owner can withdraw tokens from the contract
     */
    function withdrawTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        require(amount <= contractBalance, "Insufficient balance");
        
        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");
        emit TokensWithdrawn(token, msg.sender, amount);
    }
    
    /**
     * @dev Owner can withdraw default tokens from the contract
     */
    function withdrawTokens(uint256 amount) external onlyOwner {
        withdrawTokens(address(defaultToken), amount);
    }
    
    /**
     * @dev Emergency withdraw all tokens of a specific type
     */
    function emergencyWithdraw(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        if (contractBalance > 0) {
            require(IERC20(token).transfer(msg.sender, contractBalance), "Transfer failed");
            emit EmergencyWithdraw(token, msg.sender, contractBalance);
        }
    }
    
    /**
     * @dev Emergency withdraw all default tokens
     */
    function emergencyWithdraw() external onlyOwner {
        emergencyWithdraw(address(defaultToken));
    }
    
    /**
     * @dev Rescue tokens that were accidentally sent to the contract
     * @notice This function allows the owner to rescue any ERC20 tokens
     * @notice that were sent to the contract but not intended for airdrops
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        require(amount <= contractBalance, "Insufficient balance");
        
        require(IERC20(token).transfer(to, amount), "Transfer failed");
        emit TokensRescued(token, to, amount);
    }
    
    /**
     * @dev Rescue all tokens of a specific type
     */
    function rescueAllTokens(address token, address to) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient address");
        
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        if (contractBalance > 0) {
            require(IERC20(token).transfer(to, contractBalance), "Transfer failed");
            emit TokensRescued(token, to, contractBalance);
        }
    }
    
    /**
     * @dev Get contract balance for any token
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    /**
     * @dev Get default token balance
     */
    function getTokenBalance() external view returns (uint256) {
        return getTokenBalance(address(defaultToken));
    }
    
    /**
     * @dev Check if airdrop is active for a specific token
     */
    function isAirdropActive(address token) external view returns (bool) {
        return tokenConfigs[token].isActive;
    }
    
    /**
     * @dev Check if default airdrop is active
     */
    function isAirdropActive() external view returns (bool) {
        return isAirdropActive(address(defaultToken));
    }
}