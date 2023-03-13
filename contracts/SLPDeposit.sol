// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// solhint-disable-next-line max-line-length
import {MerkleProofUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";

interface IDepositContract {
    /// @notice Submit a Phase 0 DepositData object.
    /// @param pubkey A BLS12-381 public key.
    /// @param withdrawal_credentials Commitment to a public key for withdrawals.
    /// @param signature A BLS12-381 signature.
    /// @param deposit_data_root The SHA-256 hash of the SSZ-encoded DepositData object.
    /// Used as a protection against malformed input.
    /* solhint-disable var-name-mixedcase */
    function deposit(
        bytes calldata pubkey,
        bytes calldata withdrawal_credentials,
        bytes calldata signature,
        bytes32 deposit_data_root
    ) external payable;
    /* solhint-enable var-name-mixedcase */
}

contract SLPDeposit is OwnableUpgradeable {
    /* solhint-disable var-name-mixedcase */
    struct Validator {
        bytes pubkey;
        bytes withdrawal_credentials;
        bytes signature;
        bytes32 deposit_data_root;
    }
    /* solhint-enable var-name-mixedcase */

    /* ========== EVENTS ========== */

    event EthDeposited(address indexed sender, uint256 tokenAamount);

    /* ========== CONSTANTS ========== */

    uint256 public constant DEPOSIT_ETH = 32 ether;

    /* ========== STATE VARIABLES ========== */

    // address of Ethereum 2.0 Deposit Contract
    IDepositContract public depositContract;
    // batch id => merkle root of withdrawal_credentials
    mapping(uint256 => bytes32) public merkleRoots;
    // SLP core address
    address public slpCore;

    function initialize(address _depositContract) public initializer {
        require(_depositContract != address(0), "Invalid deposit contract");
        super.__Ownable_init();

        depositContract = IDepositContract(_depositContract);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function depositETH() external payable {
        emit EthDeposited(msg.sender, msg.value);
    }

    function batchDeposit(
        uint256 batchId,
        bytes32[] memory proof,
        bool[] memory proofFlags,
        Validator[] memory validators
    ) external onlyOwner {
        bytes32 root = merkleRoots[batchId];
        require(root != bytes32(0), "Merkle root not exists");

        bytes32[] memory leaves = new bytes32[](validators.length);
        for (uint256 i = 0; i < validators.length; i++) {
            leaves[i] = keccak256(validators[i].withdrawal_credentials);
        }
        require(
            MerkleProofUpgradeable.multiProofVerify(proof, proofFlags, root, leaves),
            "Merkle proof verification failed"
        );

        for (uint256 i = 0; i < validators.length; i++) {
            innerDeposit(validators[i]);
        }
    }

    function withdrawETH(address recipient, uint256 amount) external onlySLPCore {
        _sendValue(payable(recipient), amount);
    }

    function setMerkleRoot(uint256 batchId, bytes32 merkleRoot) external onlyOwner {
        require(merkleRoots[batchId] == bytes32(0), "Merkle root exists");
        require(merkleRoot != bytes32(0), "Invalid merkle root");
        merkleRoots[batchId] = merkleRoot;
    }

    function setSLPCore(address _slpCore) external onlyOwner {
        require(_slpCore != address(0), "Invalid SLP core address");
        slpCore = _slpCore;
    }

    function _sendValue(address payable recipient, uint256 amount) private {
        require(address(this).balance >= amount, "Insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Unable to send value");
    }

    /* ========== VIEWS ========== */

    function innerDeposit(Validator memory validator) private {
        require(address(this).balance >= DEPOSIT_ETH, "Insufficient balance");
        depositContract.deposit{value: amount}(
            validator.pubkey,
            validator.withdrawal_credentials,
            validator.signature,
            validator.deposit_data_root
        );
    }

    modifier onlySLPCore() {
        require(msg.sender == slpCore, "Invalid SLP core address");
        _;
    }
}
