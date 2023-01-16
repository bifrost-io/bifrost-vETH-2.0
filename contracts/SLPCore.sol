// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./interfaces/ISLPDeposit.sol";
import "./interfaces/IVETH.sol";

contract SLPCore is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== EVENTS ========== */

    event Deposited(address indexed sender, uint256 tokenAmount, uint256 vTokenAmount);
    event Renewed(address indexed sender, uint256 tokenAmount, uint256 vTokenAmount);

    /* ========== CONSTANTS ========== */

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /* ========== STATE VARIABLES ========== */

    address public vETH1;

    address public vETH2;

    address public slpDeposit;

    address public operator;

    uint256 public tokenPool;

    function initialize(
        address _vETH1,
        address _vETH2,
        address _slpDeposit,
        address _operator,
        uint256 _initTokenPool
    ) public initializer {
        super.__Ownable_init();
        super.__ReentrancyGuard_init();
        super.__Pausable_init();

        vETH1 = _vETH1;
        vETH2 = _vETH2;
        slpDeposit = _slpDeposit;
        operator = _operator;
        tokenPool = _initTokenPool;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function mint() external payable nonReentrant whenNotPaused {
        uint256 tokenAmount = msg.value;
        require(tokenAmount > 0, "Zero amount");

        uint256 vTokenAmount = calculateVTokenAmount(tokenAmount);
        tokenPool = tokenPool.add(tokenAmount);
        ISLPDeposit(slpDeposit).depositETH{value: tokenAmount}();
        IVETH(vETH2).mint(msg.sender, vTokenAmount);

        emit Deposited(msg.sender, tokenAmount, vTokenAmount);
    }

    function renew(uint256 vETH1Amount) external nonReentrant whenNotPaused {
        require(vETH1Amount > 0, "Zero amount");

        uint256 vTokenAmount = calculateVTokenAmount(vETH1Amount);
        tokenPool = tokenPool.add(vETH1Amount);
        IERC20Upgradeable(vETH1).safeTransferFrom(msg.sender, DEAD_ADDRESS, vETH1Amount);
        IVETH(vETH2).mint(msg.sender, vTokenAmount);

        emit Renewed(msg.sender, vETH1Amount, vTokenAmount);
    }

    function addReward(uint256 amount) external onlyOperator {
        tokenPool = tokenPool.add(amount);
    }

    function setFee() external onlyOperator {}

    function setOperator(address newOperator) external onlyOwner {
        operator = newOperator;
    }

    function pause() external onlyOwner {
        super._pause();
    }

    function unpause() external onlyOwner {
        super._unpause();
    }

    /* ========== VIEWS ========== */

    function calculateVTokenAmount(uint256 tokenAmount) public view returns (uint256 vTokenAmount) {
        uint256 vTokenTotalSupply = IERC20Upgradeable(vETH2).totalSupply();
        vTokenAmount = tokenAmount.mul(vTokenTotalSupply).div(tokenPool);
    }

    /* ========== MODIFIER ========== */

    modifier onlyOperator() {
        require(msg.sender == operator, "Caller is not operator");
        _;
    }
}
