// SPDX-License-Identifier: GPL-3.0
// solhint-disable var-name-mixedcase

pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IDepositContract {
    /// @notice Submit a Phase 0 DepositData object.
    /// @param pubkey A BLS12-381 public key.
    /// @param withdrawal_credentials Commitment to a public key for withdrawals.
    /// @param signature A BLS12-381 signature.
    /// @param deposit_data_root The SHA-256 hash of the SSZ-encoded DepositData object.
    /// Used as a protection against malformed input.
    function deposit(
        bytes calldata pubkey,
        bytes calldata withdrawal_credentials,
        bytes calldata signature,
        bytes32 deposit_data_root
    ) external payable;
}

interface IETHDepositor {
    function depositETH() external payable;
}

interface ISSVClusters {
    /// @notice Represents a cluster of validators
    struct Cluster {
        /// @dev The number of validators in the cluster
        uint32 validatorCount;
        /// @dev The index of network fees related to this cluster
        uint64 networkFeeIndex;
        /// @dev The last index calculated for the cluster
        uint64 index;
        /// @dev Flag indicating whether the cluster is active
        bool active;
        /// @dev The balance of the cluster
        uint256 balance;
    }

    /// @notice Registers a new validator on the SSV Network
    /// @param publicKey The public key of the new validator
    /// @param operatorIds Array of IDs of operators managing this validator
    /// @param sharesData Encrypted shares related to the new validator
    /// @param amount Amount of SSV tokens to be deposited
    /// @param cluster Cluster to be used with the new validator
    function registerValidator(
        bytes calldata publicKey,
        uint64[] memory operatorIds,
        bytes calldata sharesData,
        uint256 amount,
        Cluster memory cluster
    ) external;

    /// @notice Liquidates a cluster
    /// @param owner The owner of the cluster
    /// @param operatorIds Array of IDs of operators managing the cluster
    /// @param cluster Cluster to be liquidated
    function liquidate(address owner, uint64[] memory operatorIds, Cluster memory cluster) external;

    /// @notice Removes an existing validator from the SSV Network
    /// @param publicKey The public key of the validator to be removed
    /// @param operatorIds Array of IDs of operators managing the validator
    /// @param cluster Cluster associated with the validator
    function removeValidator(bytes calldata publicKey, uint64[] memory operatorIds, Cluster memory cluster) external;

    /// @notice Reactivates a cluster
    /// @param operatorIds Array of IDs of operators managing the cluster
    /// @param amount Amount of SSV tokens to be deposited for reactivation
    /// @param cluster Cluster to be reactivated
    function reactivate(uint64[] memory operatorIds, uint256 amount, Cluster memory cluster) external;

    /// @notice Withdraws tokens from a cluster
    /// @param operatorIds Array of IDs of operators managing the cluster
    /// @param tokenAmount Amount of SSV tokens to be withdrawn
    /// @param cluster Cluster where the withdrawal will be made
    function withdraw(uint64[] memory operatorIds, uint256 tokenAmount, Cluster memory cluster) external;
}

contract SLPDeposit is OwnableUpgradeable {
    struct Validator {
        bytes pubkey;
        bytes withdrawal_credentials;
        bytes signature;
        bytes32 deposit_data_root;
    }

    /* ========== EVENTS ========== */

    event EthDeposited(address indexed sender, uint256 tokenAmount);

    /* ========== CONSTANTS ========== */

    uint256 public constant DEPOSIT_SIZE = 32 ether;
    // solhint-disable-next-line max-line-length
    // Refer to https://github.com/lidofinance/lido-dao/blob/14503a5a9c7c46864704bb3561e22ae2f84a04ff/contracts/0.8.9/BeaconChainDepositor.sol#L27
    uint64 public constant DEPOSIT_SIZE_IN_GWEI_LE64 = 0x0040597307000000;
    uint256 public constant MAX_VALIDATORS_PER_DEPOSIT = 50;

    /* ========== STATE VARIABLES ========== */

    // address of Ethereum 2.0 Deposit Contract
    IDepositContract public depositContract;
    // @deprecated batch id => merkle root of withdrawal_credentials
    mapping(uint256 => bytes32) public merkleRoots;
    // SLP core address
    address public slpCore;
    // withdrawal_credentials with prefix 0x01
    bytes public withdrawalCredentials;
    // WithdrawVault address
    address public withdrawVault;
    // SSVNetwork address
    address public ssvNetwork;
    // SSVToken address
    address public ssvToken;

    /* ========== EVENTS ========== */

    event SLPCoreSet(address indexed sender, address slpCore);
    event WithdrawalCredentialsSet(address indexed sender, bytes withdrawalCredentials);

    function initialize(address _depositContract) public initializer {
        require(_depositContract != address(0), "Invalid deposit contract");
        super.__Ownable_init();

        depositContract = IDepositContract(_depositContract);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    // Only called by SLP contracts. If you don't know the purpose of this method, please don't call it directly.
    function depositETH() external payable {
        emit EthDeposited(msg.sender, msg.value);
    }

    function depositSSV(
        Validator calldata validator,
        uint64[] memory operatorIds,
        bytes calldata sharesData,
        uint256 amount,
        ISSVClusters.Cluster memory cluster
    ) external onlyOwner {
        require(withdrawalCredentials[0] == 0x01, "Wrong credential prefix");
        require(checkDepositDataRoot(validator), "Invalid deposit data");

        innerDeposit(validator);
        if (amount > 0) {
            IERC20Upgradeable(ssvToken).transferFrom(msg.sender, address(this), amount);
            IERC20Upgradeable(ssvToken).approve(ssvNetwork, amount);
        }
        ISSVClusters(ssvNetwork).registerValidator(validator.pubkey, operatorIds, sharesData, amount, cluster);
    }

    function registerValidatorSSV(
        bytes calldata publicKey,
        uint64[] memory operatorIds,
        bytes calldata sharesData,
        uint256 amount,
        ISSVClusters.Cluster memory cluster
    ) external onlyOwner {
        if (amount > 0) {
            IERC20Upgradeable(ssvToken).transferFrom(msg.sender, address(this), amount);
            IERC20Upgradeable(ssvToken).approve(ssvNetwork, amount);
        }
        ISSVClusters(ssvNetwork).registerValidator(publicKey, operatorIds, sharesData, amount, cluster);
    }

    function removeValidatorSSV(
        bytes calldata publicKey,
        uint64[] memory operatorIds,
        ISSVClusters.Cluster memory cluster
    ) external onlyOwner {
        ISSVClusters(ssvNetwork).removeValidator(publicKey, operatorIds, cluster);
    }

    function liquidateSSV(uint64[] memory operatorIds, ISSVClusters.Cluster memory cluster) external onlyOwner {
        ISSVClusters(ssvNetwork).liquidate(address(this), operatorIds, cluster);
    }

    function reactivateSSV(
        uint64[] memory operatorIds,
        uint256 amount,
        ISSVClusters.Cluster memory cluster
    ) external onlyOwner {
        IERC20Upgradeable(ssvToken).approve(ssvNetwork, amount);
        ISSVClusters(ssvNetwork).reactivate(operatorIds, amount, cluster);
    }

    function withdrawSSV(
        uint64[] memory operatorIds,
        ISSVClusters.Cluster memory cluster,
        address to,
        uint256 tokenAmount
    ) external onlyOwner {
        ISSVClusters(ssvNetwork).withdraw(operatorIds, tokenAmount, cluster);
        IERC20Upgradeable(ssvToken).transfer(to, tokenAmount);
    }

    function batchDeposit(Validator[] calldata validators) external onlyOwner {
        require(validators.length <= MAX_VALIDATORS_PER_DEPOSIT, "Too many validators");
        require(withdrawalCredentials[0] == 0x01, "Wrong credential prefix");
        for (uint256 i = 0; i < validators.length; i++) {
            require(checkDepositDataRoot(validators[i]), "Invalid deposit data");
            innerDeposit(validators[i]);
        }
    }

    function withdrawETH(address recipient, uint256 amount) external onlySLPCoreOrWithdrawVault {
        IETHDepositor(recipient).depositETH{value: amount}();
    }

    function setCredential(address receiver) external onlyOwner {
        require(receiver != address(0), "Invalid receiver");
        withdrawalCredentials = abi.encodePacked(bytes12(0x010000000000000000000000), receiver);
        emit WithdrawalCredentialsSet(msg.sender, withdrawalCredentials);
    }

    function setSLPCore(address _slpCore) external onlyOwner {
        require(_slpCore != address(0), "Invalid SLP core address");
        slpCore = _slpCore;
        emit SLPCoreSet(msg.sender, slpCore);
    }

    function setWithdrawVault(address _withdrawVault) external onlyOwner {
        require(_withdrawVault != address(0), "Invalid withdraw vault address");
        withdrawVault = _withdrawVault;
    }

    function setSSVNetwork(address _ssvNetwork) external onlyOwner {
        require(_ssvNetwork != address(0), "Invalid SSV network address");
        ssvNetwork = _ssvNetwork;
    }

    function setSSVToken(address _ssvToken) external onlyOwner {
        require(_ssvToken != address(0), "Invalid SSV token address");
        ssvToken = _ssvToken;
    }

    function innerDeposit(Validator memory validator) private {
        require(address(this).balance >= DEPOSIT_SIZE, "Insufficient balance");
        depositContract.deposit{value: DEPOSIT_SIZE}(
            validator.pubkey,
            validator.withdrawal_credentials,
            validator.signature,
            validator.deposit_data_root
        );
    }

    /* ========== VIEWS ========== */

    function checkDepositDataRoot(Validator calldata validator) public view returns (bool) {
        Validator memory _validator = getValidatorData(validator.pubkey, validator.signature);
        return _validator.deposit_data_root == validator.deposit_data_root;
    }

    function getValidatorData(bytes calldata pubkey, bytes calldata signature) public view returns (Validator memory) {
        bytes32 pubkey_root = sha256(abi.encodePacked(pubkey, bytes16(0)));
        bytes32 signature_root = sha256(
            abi.encodePacked(
                sha256(abi.encodePacked(signature[:64])),
                sha256(abi.encodePacked(signature[64:], bytes32(0)))
            )
        );
        bytes32 deposit_data_root = sha256(
            abi.encodePacked(
                sha256(abi.encodePacked(pubkey_root, withdrawalCredentials)),
                sha256(abi.encodePacked(DEPOSIT_SIZE_IN_GWEI_LE64, bytes24(0), signature_root))
            )
        );

        return Validator(pubkey, withdrawalCredentials, signature, deposit_data_root);
    }

    modifier onlySLPCoreOrWithdrawVault() {
        require(msg.sender == slpCore || msg.sender == withdrawVault, "Invalid sender");
        _;
    }
}
