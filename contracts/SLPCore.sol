// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

interface IVETH {
    function mint(address account, uint amount) external;

    function burn(address account, uint amount) external;
}

interface ISLPDeposit {
    function depositETH() external payable;
}

contract SLPCore is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct Withdrawal {
        uint256 queued;
        uint256 pending;
    }

    /* ========== EVENTS ========== */

    event Deposited(address indexed sender, uint256 tokenAmount, uint256 vTokenAmount);
    event Renewed(address indexed sender, uint256 tokenAmount, uint256 vTokenAmount);

    event RewardAdded(address indexed sender, uint256 tokenAamount, uint256 vTokenfee);
    event RewardRemoved(address indexed sender, uint256 tokenAmount);

    event WithdrawalRequested(address indexed sender, uint256 tokenAmount, uint256 vTokenAmount);
    event WithdrawalCompleted(address indexed sender, uint256 tokenAmount);
    event WithdrawalDeposited(address indexed sender, uint256 tokenAmount);

    /* ========== CONSTANTS ========== */

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant FEE_RATE_DENOMINATOR = 1e4;
    uint256 public constant DEPOSIT_ETH = 32 ether;

    /* ========== STATE VARIABLES ========== */

    address public vETH1;
    address public vETH2;
    address public slpDeposit;
    address public mevVault;
    address public withdrawalVault;
    address public operator;
    address public feeReceiver;
    uint256 public tokenPool;
    uint256 public feeRate;

    uint256 public queuedWithdrawal;
    uint256 public completedWithdrawal;
    mapping(address => Withdrawal) public withdrawals;

    function initialize(
        address _vETH1,
        address _vETH2,
        address _slpDeposit,
        address _operator,
        address _feeReceiver,
        uint256 _feeRate
    ) public initializer {
        require(_vETH1 != address(0), "Invalid vETH1");
        require(_vETH2 != address(0), "Invalid vETH2");
        require(_slpDeposit != address(0), "Invalid SLP deposit address");
        require(IERC20Upgradeable(_vETH2).totalSupply() > 0, "Invalid totalSupply of vETH2");

        super.__Ownable_init();
        super.__ReentrancyGuard_init();
        super.__Pausable_init();

        _setFeeRate(_feeRate);
        _setFeeReceiver(_feeReceiver);
        _setOperator(_operator);
        vETH1 = _vETH1;
        vETH2 = _vETH2;
        slpDeposit = _slpDeposit;
        tokenPool = IERC20Upgradeable(_vETH2).totalSupply();
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function mint() external payable nonReentrant whenNotPaused {
        uint256 tokenAmount = msg.value;
        require(tokenAmount > 0, "Zero amount");
        uint256 vTokenAmount = calculateVTokenAmount(tokenAmount);
        require(vTokenAmount > 0, "Zero amount");
        tokenPool = tokenPool + tokenAmount;
        ISLPDeposit(slpDeposit).depositETH{value: tokenAmount}();
        IVETH(vETH2).mint(msg.sender, vTokenAmount);

        emit Deposited(msg.sender, tokenAmount, vTokenAmount);
    }

    function renew(uint256 vETH1Amount) external nonReentrant whenNotPaused {
        require(vETH1Amount > 0, "Zero amount");

        uint256 tokenAmount = vETH1Amount;
        uint256 vTokenAmount = calculateVTokenAmount(tokenAmount);
        tokenPool = tokenPool + tokenAmount;
        IERC20Upgradeable(vETH1).safeTransferFrom(msg.sender, DEAD_ADDRESS, tokenAmount);
        IVETH(vETH2).mint(msg.sender, vTokenAmount);

        emit Renewed(msg.sender, tokenAmount, vTokenAmount);
    }

    function withdrawRequest(uint256 vTokenAmount) external nonReentrant whenNotPaused {
        Withdrawal storage withdrawal = withdrawals[msg.sender];
        // calculate ETH
        uint256 tokenAmount = calculateTokenAmount(vTokenAmount);
        withdrawal.pending = withdrawal.pending + tokenAmount;
        withdrawal.queued = queuedWithdrawal;
        queuedWithdrawal = queuedWithdrawal + tokenAmount;
        tokenPool = tokenPool - tokenAmount;
        IVETH(vETH2).burn(msg.sender, tokenAmount);

        emit WithdrawalRequested(msg.sender, tokenAmount, vTokenAmount);
    }

    function withdrawComplete(uint256 tokenAmount) external nonReentrant whenNotPaused {
        Withdrawal storage withdrawal = withdrawals[msg.sender];

        if (tokenAmount == 0) {
            // withdraw total pending amount
            tokenAmount = withdrawal.pending;
        }

        require(tokenAmount <= withdrawal.pending, "Exceed permitted amount");
        require(tokenAmount <= canWithdrawalAmount(msg.sender), "Insufficient withdrawal amount");

        withdrawal.pending = withdrawal.pending - tokenAmount;
        completedWithdrawal = completedWithdrawal + tokenAmount;
        _sendValue(payable(msg.sender), tokenAmount);

        emit WithdrawalCompleted(msg.sender, tokenAmount);
    }

    function addReward(uint256 amount) external onlyVault {
        uint256 tokenFee = (amount * feeRate) / FEE_RATE_DENOMINATOR;
        uint256 vTokenFee = calculateVTokenAmount(tokenFee);
        tokenPool = tokenPool + amount;
        // Fee: mint vETH as reward fee to Treasury
        IVETH(vETH2).mint(feeReceiver, vTokenFee);

        emit RewardAdded(msg.sender, amount, vTokenFee);
    }

    function removeReward(uint256 amount) external onlyVault {
        tokenPool = tokenPool - amount;

        emit RewardRemoved(msg.sender, amount);
    }

    function depositWithdrawal() external payable {
        require(msg.sender == withdrawalVault, "Invalid sender");

        emit WithdrawalDeposited(msg.sender, msg.value);
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

    function setWithdrawalVault(address _withdrawalVault) external onlyOwner {
        require(_withdrawalVault != address(0), "Invalid withdrawal vault address");
        withdrawalVault = _withdrawalVault;
    }

    function setMevVault(address _mevVault) external onlyOwner {
        require(_mevVault != address(0), "Invalid MEV vault address");
        mevVault = _mevVault;
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

    function _setOperator(address _newOperator) private {
        require(_newOperator != address(0), "Invalid operator address");
        operator = _newOperator;
    }

    function _sendValue(address payable recipient, uint256 amount) private {
        require(address(this).balance >= amount, "Insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Unable to send value");
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

    function getTotalETH() public view returns (uint256) {
        return address(this).balance + completedWithdrawal;
    }

    function canWithdrawalAmount(address target) public view returns (uint256) {
        Withdrawal memory withdrawal = withdrawals[target];

        if (getTotalETH() <= withdrawal.queued) {
            return 0;
        }

        uint256 availableAmount = getTotalETH() - withdrawal.queued;
        availableAmount = address(this).balance < availableAmount ? address(this).balance : availableAmount;

        return withdrawal.pending < availableAmount ? withdrawal.pending : availableAmount;
    }

    /* ========== MODIFIER ========== */

    modifier onlyOperator() {
        require(msg.sender == operator, "Caller is not operator");
        _;
    }

    modifier onlyVault() {
        require(msg.sender == mevVault || msg.sender == withdrawalVault, "Caller is not vault contract");
        _;
    }
}
