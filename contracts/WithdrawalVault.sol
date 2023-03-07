// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

interface ISLPCore {
    function depositWithdrawals() external payable;
}

interface ISLPDeposit {
    function depositETH() external payable;
}

contract WithdrawalVault is OwnableUpgradeable {
    uint256 public constant DEPOSIT_ETH = 32 ether;

    ISLPCore public slpCore;
    ISLPDeposit public slpDeposit;

    uint256 public withdrawalNodeNumber;
    uint256 public totalWithdrawalAmount;

    function initialize(address _slpCore, address _slpDeposit) public initializer {
        require(_slpCore != address(0), "Invalid SLP core address");
        require(_slpDeposit != address(0), "Invalid SLP deposit address");
        super.__Ownable_init();

        slpCore = ISLPCore(_slpCore);
        slpDeposit = ISLPDeposit(_slpDeposit);
    }

    function withdrawWithdrawals(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Zero amount");
        require(_amount <= address(this).balance, "Not enough balance");
        require(totalWithdrawalAmount + _amount <= withdrawalNodeNumber * DEPOSIT_ETH, "Exceed total ETH");
        totalWithdrawalAmount = totalWithdrawalAmount + _amount;
        slpCore.depositWithdrawals{value: _amount}();
    }

    function payRewards(uint256 _rewardAmount) external onlyOwner {
        slpDeposit.depositETH{value: _rewardAmount}();
    }

    function increaseWithdrawalNodeNumber(uint256 n) external onlyOwner {
        require((withdrawalNodeNumber + n) * DEPOSIT_ETH <= address(this).balance, "Exceed total ETH");
        withdrawalNodeNumber += n;
    }
}
