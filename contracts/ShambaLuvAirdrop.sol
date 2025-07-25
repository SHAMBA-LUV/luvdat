// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ShambaLuvAirdrop
 * @dev Simple airdrop contract for SHAMBA LUV token
 * @notice Automatically gives tokens to new users who connect their wallet
 */
contract ShambaLuvAirdrop is Ownable, ReentrancyGuard {
    IERC20 public immutable shambaLuvToken;
    
    // Airdrop amount per user (1 trillion tokens with 18 decimals)
    uint256 public airdropAmount = 1_000_000_000_000 * 1e18;
    
    // Track who has already claimed
    mapping(address => bool) public hasClaimed;
    
    // Stats
    uint256 public totalClaimed;
    uint256 public totalRecipients;
    
    // Events
    event AirdropClaimed(address indexed recipient, uint256 amount);
    event AirdropAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event TokensWithdrawn(address indexed owner, uint256 amount);
    
    constructor(address _shambaLuvToken) {
        require(_shambaLuvToken != address(0), "Invalid token address");
        shambaLuvToken = IERC20(_shambaLuvToken);
    }
    
    /**
     * @dev Claim airdrop tokens (one-time per address)
     */
    function claimAirdrop() external nonReentrant {
        require(!hasClaimed[msg.sender], "Already claimed");
        require(airdropAmount > 0, "Airdrop amount not set");
        
        // Check contract has enough tokens
        uint256 contractBalance = shambaLuvToken.balanceOf(address(this));
        require(contractBalance >= airdropAmount, "Insufficient tokens in contract");
        
        // Mark as claimed
        hasClaimed[msg.sender] = true;
        totalClaimed += airdropAmount;
        totalRecipients++;
        
        // Transfer tokens
        require(shambaLuvToken.transfer(msg.sender, airdropAmount), "Transfer failed");
        
        emit AirdropClaimed(msg.sender, airdropAmount);
    }
    
    /**
     * @dev Check if an address has already claimed
     */
    function hasUserClaimed(address user) external view returns (bool) {
        return hasClaimed[user];
    }
    
    /**
     * @dev Get airdrop stats
     */
    function getAirdropStats() external view returns (
        uint256 _airdropAmount,
        uint256 _totalClaimed,
        uint256 _totalRecipients,
        uint256 _contractBalance
    ) {
        return (
            airdropAmount,
            totalClaimed,
            totalRecipients,
            shambaLuvToken.balanceOf(address(this))
        );
    }
    
    /**
     * @dev Owner can update airdrop amount
     */
    function setAirdropAmount(uint256 _newAmount) external onlyOwner {
        uint256 oldAmount = airdropAmount;
        airdropAmount = _newAmount;
        emit AirdropAmountUpdated(oldAmount, _newAmount);
    }
    
    /**
     * @dev Owner can deposit tokens to the contract
     */
    function depositTokens(uint256 amount) external onlyOwner {
        require(shambaLuvToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
    }
    
    /**
     * @dev Owner can withdraw remaining tokens
     */
    function withdrawTokens(uint256 amount) external onlyOwner {
        uint256 contractBalance = shambaLuvToken.balanceOf(address(this));
        require(amount <= contractBalance, "Insufficient balance");
        
        require(shambaLuvToken.transfer(msg.sender, amount), "Transfer failed");
        emit TokensWithdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Emergency withdraw all tokens
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 contractBalance = shambaLuvToken.balanceOf(address(this));
        if (contractBalance > 0) {
            require(shambaLuvToken.transfer(msg.sender, contractBalance), "Transfer failed");
            emit TokensWithdrawn(msg.sender, contractBalance);
        }
    }
}