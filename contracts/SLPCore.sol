// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/ISLPDeposit.sol";
import "./interfaces/IVETH.sol";

contract SLPCore is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct Withdrawal {
        uint256 queued;
        uint256 pending;
    }

    /* ========== EVENTS ========== */

    event Deposited(address indexed sender, uint256 tokenAmount, uint256 vTokenAmount);
    event Renewed(address indexed sender, uint256 tokenAmount, uint256 vTokenAmount);
    event RewardAdded(address indexed sender, uint256 amount, uint256 fee);
    event RewardRemoved(address indexed sender, uint256 amount);

    event WithdrawRequested(address indexed sender, uint256 vETHAmount, uint256 ethAmount);
    event WithdrawCompleted(address indexed sender, uint256 ethAmount);

    /* ========== CONSTANTS ========== */

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant FEE_RATE_DENOMINATOR = 1e4;
    uint256 public constant DEPOSIT_ETH = 32 ether;

    /* ========== STATE VARIABLES ========== */

    address public vETH1;
    address public vETH2;
    address public slpDeposit;
    address public operator;
    address public feeReceiver;
    uint256 public tokenPool;
    uint256 public feeRate;
    mapping(uint256 => bool) public rewardDays;

    uint256 public queuedWithdrawal;
    uint256 public completedWithdrawal;
    uint256 public withdrawalNodeNumber;
    mapping(address => Withdrawal) public withdrawals;

    function initialize(
        address _vETH1,
        address _vETH2,
        address _slpDeposit,
        address _operator,
        address _feeReceiver,
        uint256 _initTokenPool,
        uint256 _feeRate
    ) public initializer {
        require(_vETH1 != address(0), "Invalid vETH1");
        require(_vETH2 != address(0), "Invalid vETH2");
        require(_slpDeposit != address(0), "Invalid SLP deposit address");

        super.__Ownable_init();
        super.__ReentrancyGuard_init();
        super.__Pausable_init();

        _setFeeRate(_feeRate);
        _setFeeReceiver(_feeReceiver);
        _setOperator(_operator);
        vETH1 = _vETH1;
        vETH2 = _vETH2;
        slpDeposit = _slpDeposit;
        tokenPool = _initTokenPool;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function mint() external payable nonReentrant whenNotPaused {
        uint256 tokenAmount = msg.value;
        require(tokenAmount > 0, "Zero amount");

        uint256 vTokenAmount = calculateVTokenAmount(tokenAmount);
        tokenPool = tokenPool + tokenAmount;
        ISLPDeposit(slpDeposit).depositETH{value: tokenAmount}();
        IVETH(vETH2).mint(msg.sender, vTokenAmount);

        emit Deposited(msg.sender, tokenAmount, vTokenAmount);
    }

    function renew(uint256 vETH1Amount) external nonReentrant whenNotPaused {
        require(vETH1Amount > 0, "Zero amount");

        uint256 vTokenAmount = calculateVTokenAmount(vETH1Amount);
        tokenPool = tokenPool + vETH1Amount;
        IERC20Upgradeable(vETH1).safeTransferFrom(msg.sender, DEAD_ADDRESS, vETH1Amount);
        IVETH(vETH2).mint(msg.sender, vTokenAmount);

        emit Renewed(msg.sender, vETH1Amount, vTokenAmount);
    }

    function withdrawRequest(uint256 vETHAmount) external nonReentrant whenNotPaused {
        Withdrawal storage withdrawal = withdrawals[msg.sender];
        // calculate ETH
        uint256 ethAmount = calculateTokenAmount(vETHAmount);
        withdrawal.pending += ethAmount;
        withdrawal.queued = queuedWithdrawal;
        queuedWithdrawal += ethAmount;
        IVETH(vETH2).burn(msg.sender, ethAmount);

        emit WithdrawRequested(msg.sender, vETHAmount, ethAmount);
    }

    function withdrawComplete(uint256 ethAmount) external nonReentrant whenNotPaused {
        Withdrawal storage withdrawal = withdrawals[msg.sender];

        require(ethAmount <= withdrawal.pending, "Insufficient withdrawal amount");
        uint256 totalETH = getHistoryETH();
        require(withdrawalNodeNumber * DEPOSIT_ETH <= totalETH, "Exceed total ETH");
        require(withdrawal.queued + ethAmount <= totalETH, "Exceed total ETH");

        withdrawal.pending -= ethAmount;
        completedWithdrawal += ethAmount;
        payable(msg.sender).transfer(ethAmount);

        emit WithdrawCompleted(msg.sender, ethAmount);
    }

    function adjustWithdrawalNodeNumber(uint256 n) external onlyOperator {
        require((withdrawalNodeNumber + n) * DEPOSIT_ETH <= getHistoryETH(), "Exceed total ETH");
        withdrawalNodeNumber += n;
    }

    function withdrawReward() external onlyOperator {
        uint256 totalETH = getHistoryETH();
        require(withdrawalNodeNumber * DEPOSIT_ETH <= totalETH, "Exceed total ETH");
        uint256 rewardAmount = totalETH - (withdrawalNodeNumber * DEPOSIT_ETH);
        ISLPDeposit(slpDeposit).depositETH{value: rewardAmount}();
    }

    function addReward(uint256 amount) external onlyOperator {
        uint256 rewardAt = getTodayTimestamp();
        require(!rewardDays[rewardAt], "Reward paid today");
        rewardDays[rewardAt] = true;

        uint256 tokenFee = (amount * feeRate) / FEE_RATE_DENOMINATOR;
        uint256 vTokenFee = calculateVTokenAmount(tokenFee);
        tokenPool = tokenPool + amount;
        // Fee: mint vETH to Treasury(multi-sig contract)
        IVETH(vETH2).mint(feeReceiver, vTokenFee);

        emit RewardAdded(msg.sender, amount, vTokenFee);
    }

    function removeReward(uint256 amount) external onlyOperator {
        uint256 rewardAt = getTodayTimestamp();
        require(!rewardDays[rewardAt], "Reward paid today");
        rewardDays[rewardAt] = true;

        tokenPool = tokenPool - amount;

        emit RewardRemoved(msg.sender, amount);
    }

    function setFeeRate(uint256 _feeRate) external onlyOwner {
        _setFeeRate(_feeRate);
    }

    function setFeeReceiver(address _feeReceiver) external onlyOwner {
        _setFeeReceiver(_feeReceiver);
    }

    function setOperator(address newOperator) external onlyOwner {
        _setOperator(newOperator);
    }

    function pause() external onlyOwner {
        super._pause();
    }

    function unpause() external onlyOwner {
        super._unpause();
    }

    function _setFeeRate(uint256 _feeRate) private {
        require(_feeRate <= FEE_RATE_DENOMINATOR, "Fee rate exceeds range");
        feeRate = _feeRate;
    }

    function _setFeeReceiver(address _feeReceiver) private {
        require(_feeReceiver != address(0), "Invalid fee receiver address");
        feeReceiver = _feeReceiver;
    }

    function _setOperator(address newOperator) private {
        require(newOperator != address(0), "Invalid operator address");
        operator = newOperator;
    }

    /* ========== VIEWS ========== */

    function calculateVTokenAmount(uint256 tokenAmount) public view returns (uint256 vTokenAmount) {
        uint256 vTokenTotalSupply = IERC20Upgradeable(vETH2).totalSupply();
        vTokenAmount = (tokenAmount * vTokenTotalSupply) / tokenPool;
    }

    function calculateTokenAmount(uint256 vTokenAmount) public view returns (uint256 tokenAmount) {
        uint256 vTokenTotalSupply = IERC20Upgradeable(vETH2).totalSupply();
        tokenAmount = (vTokenAmount * tokenPool) / vTokenTotalSupply;
    }

    function getTodayTimestamp() public view returns (uint256) {
        return (block.timestamp / (1 days)) * (1 days);
    }

    function getHistoryETH() public view returns (uint256) {
        return address(this).balance + completedWithdrawal;
    }

    /* ========== MODIFIER ========== */

    modifier onlyOperator() {
        require(msg.sender == operator, "Caller is not operator");
        _;
    }
}
