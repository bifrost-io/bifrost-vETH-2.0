// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

interface ISLPCore {
    function addReward(uint256 amount) external;

    function removeReward(uint256 amount) external;

    function depositWithdrawal() external payable;
}

interface ISLPDeposit {
    function depositETH() external payable;
}

contract WithdrawalVault is OwnableUpgradeable {
    /* ========== EVENTS ========== */

    /* ========== CONSTANTS ========== */

    uint256 public constant DEPOSIT_ETH = 32 ether;

    /* ========== STATE VARIABLES ========== */

    ISLPCore public slpCore;
    ISLPDeposit public slpDeposit;

    uint256 public withdrawalNodeNumber;
    uint256 public totalWithdrawalAmount;

    mapping(uint256 => bool) public rewardDays;

    function initialize(address _slpCore, address _slpDeposit) public initializer {
        require(_slpCore != address(0), "Invalid SLP core address");
        require(_slpDeposit != address(0), "Invalid SLP deposit address");
        super.__Ownable_init();

        slpCore = ISLPCore(_slpCore);
        slpDeposit = ISLPDeposit(_slpDeposit);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function withdrawWithdrawals(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Zero amount");
        require(_amount <= address(this).balance, "Not enough balance");
        require(totalWithdrawalAmount + _amount <= withdrawalNodeNumber * DEPOSIT_ETH, "Exceed total ETH");
        totalWithdrawalAmount = totalWithdrawalAmount + _amount;
        slpCore.depositWithdrawal{value: _amount}();
    }

    function increaseWithdrawalNode(uint256 n) external onlyOwner {
        require((withdrawalNodeNumber + n) * DEPOSIT_ETH <= address(this).balance, "Exceed total ETH");
        withdrawalNodeNumber += n;
    }

    function addReward(uint256 _rewardAmount) external onlyOwner {
        uint256 paidAt = getTodayTimestamp();
        require(!rewardDays[paidAt], "Paid today");
        rewardDays[paidAt] = true;

        require(
            _rewardAmount <= (totalWithdrawalAmount + address(this).balance) - (withdrawalNodeNumber * DEPOSIT_ETH),
            "Exceed total ETH"
        );
        require(_rewardAmount <= address(this).balance, "Not enough ETH");
        slpCore.addReward(_rewardAmount);
        slpDeposit.depositETH{value: _rewardAmount}();
    }

    function removeReward(uint256 _rewardAmount) external onlyOwner {
        uint256 rewardAt = getTodayTimestamp();
        require(!rewardDays[rewardAt], "Paid today");
        rewardDays[rewardAt] = true;

        slpCore.removeReward(_rewardAmount);
    }

    /* ========== VIEWS ========== */

    function getTodayTimestamp() public view returns (uint256) {
        return (block.timestamp / (1 days)) * (1 days);
    }
}
