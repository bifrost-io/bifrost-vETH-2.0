// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

contract MevReward is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    /* ========== EVENTS ========== */

    event RewardReceived(address indexed sender, uint256 amount);
    event RewardPaid(address indexed sender, address receiver, uint256 amount);
    event FeeWithdrawn(address indexed sender, address receiver, uint256 amount);

    /* ========== CONSTANTS ========== */

    uint256 public constant FEE_RATE_DENOMINATOR = 1e4;
    uint256 public constant REWARD_DURATION = 30;
    uint256 public constant REWARD_DURATION_DAYS = REWARD_DURATION * 1 days;

    /* ========== STATE VARIABLES ========== */

    struct Reward {
        uint256 total;
        uint256 perDay;
        uint256 paid;
        uint256 pending;
        uint256 lastPaidAt;
        uint256 finishAt;
    }

    struct Fee {
        uint256 feeRate;
        uint256 totalFee;
        uint256 claimedFee;
    }

    Fee public fee;
    Reward public reward;
    address public rewardReceiver;

    function initialize(uint256 _feeRate, address _rewardReceiver) public initializer {
        super.__Ownable_init();

        reward.lastPaidAt = block.timestamp;
        reward.finishAt = block.timestamp;
        rewardReceiver = _rewardReceiver;
        _setFeeRate(_feeRate);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function payReward() external onlyOwner returns (uint256 rewardAmount) {
        rewardAmount = reward.pending.add(reward.perDay.mul(_getTimes()));
        require(reward.paid.add(rewardAmount) <= reward.total, "Pay amount exceeds range");

        reward.paid = reward.paid.add(rewardAmount);
        reward.pending = 0;
        uint256 paidAt = block.timestamp.div(1 days).mul(1 days);
        reward.lastPaidAt = paidAt <= reward.finishAt ? paidAt : reward.finishAt;

        payable(rewardReceiver).transfer(rewardAmount);

        emit RewardPaid(msg.sender, rewardReceiver, rewardAmount);
    }

    function setFeeRate(uint256 _feeRate) external onlyOwner {
        _setFeeRate(_feeRate);
    }

    function setRewardReceiver(address _rewardReceiver) external onlyOwner {
        rewardReceiver = _rewardReceiver;
    }

    function withdrawFee(address receiver, uint256 amount) external onlyOwner {
        require(fee.claimedFee.add(amount) <= fee.totalFee, "Withdraw amount exceeds range");
        fee.claimedFee = fee.claimedFee.add(amount);
        payable(receiver).transfer(amount);

        emit FeeWithdrawn(msg.sender, receiver, amount);
    }

    function _setFeeRate(uint256 _feeRate) private {
        require(_feeRate <= FEE_RATE_DENOMINATOR, "Fee rate exceeds range");
        fee.feeRate = _feeRate;
    }

    receive() external payable {
        uint256 feeAmount = msg.value.mul(fee.feeRate).div(FEE_RATE_DENOMINATOR);
        uint256 rewardAmount = msg.value.sub(feeAmount);
        require(rewardAmount >= REWARD_DURATION, "Reward amount is too low");

        reward.lastPaidAt = block.timestamp.div(1 days).mul(1 days);
        reward.finishAt = reward.lastPaidAt.add(REWARD_DURATION_DAYS);
        reward.pending = reward.pending.add(reward.perDay.mul(_getTimes()));
        reward.total = reward.total.add(rewardAmount);
        reward.perDay = reward.total.sub(reward.paid).div(REWARD_DURATION);

        fee.totalFee = fee.totalFee.add(feeAmount);

        emit RewardReceived(msg.sender, msg.value);
    }

    /* ========== VIEWS ========== */

    function _getTimes() private view returns (uint256 times) {
        uint256 endAt = block.timestamp <= reward.finishAt ? block.timestamp : reward.finishAt;
        times = endAt.sub(reward.lastPaidAt).div(1 days);
    }
}
