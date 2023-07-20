import { ethers } from 'hardhat'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import crypto from 'crypto'
import { MerkleTree } from 'merkletreejs'
import depositData from './data/deposit_data.json'

describe('SLPDeposit', function () {
  let depositContract: Contract
  let slpDeposit: Contract
  let deployer: SignerWithAddress
  let newOwner: SignerWithAddress
  let attacker: SignerWithAddress
  let mockWithdrawVault: SignerWithAddress
  const batchId = 0

  beforeEach(async function () {
    ;[deployer, newOwner, attacker, mockWithdrawVault] = await ethers.getSigners()

    const DepositContract = await ethers.getContractFactory('DepositContract')
    const SLPDeposit = await ethers.getContractFactory('SLPDeposit')
    slpDeposit = await SLPDeposit.deploy()
    depositContract = await DepositContract.deploy()
    await slpDeposit.initialize(depositContract.address)
    await slpDeposit.setWithdrawVault(mockWithdrawVault.address)
  })

  it('basic check', async function () {
    expect(await slpDeposit.depositContract()).to.equal(depositContract.address)
    expect(await slpDeposit.withdrawVault()).to.equal(mockWithdrawVault.address)
  })

  it('transfer owner should be ok', async function () {
    await slpDeposit.transferOwnership(newOwner.address)
    expect(await slpDeposit.owner()).to.equal(newOwner.address)
  })

  it('transfer owner by attacker should revert', async function () {
    await expect(slpDeposit.connect(attacker).transferOwnership(newOwner.address)).to.revertedWith(
      'Ownable: caller is not the owner'
    )
  })

  describe('Batch deposit', function () {
    let allValidators: any[]
    let validators: any[]

    it('setMerkleRoot by owner should be ok', async function () {
      const merkleRoot = `0x${crypto.randomBytes(32).toString('hex')}`
      await slpDeposit.setMerkleRoot(batchId, merkleRoot)
      expect(await slpDeposit.merkleRoots(batchId)).to.equal(merkleRoot)
    })

    it('re-setMerkleRoot by owner should revert', async function () {
      const merkleRoot = `0x${crypto.randomBytes(32).toString('hex')}`
      await slpDeposit.setMerkleRoot(batchId, merkleRoot)
      await expect(slpDeposit.setMerkleRoot(batchId, merkleRoot)).to.revertedWith('Merkle root exists')
    })

    it('setMerkleRoot with invalid merkle root should revert', async function () {
      await expect(slpDeposit.setMerkleRoot(batchId, ethers.constants.HashZero)).to.revertedWith('Invalid merkle root')
    })

    it('setMerkleRoot by attacker should revert', async function () {
      const merkleRoot = `0x${crypto.randomBytes(32).toString('hex')}`
      await expect(slpDeposit.connect(attacker).setMerkleRoot(batchId, merkleRoot)).to.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    describe('batchDepositWithProof', function () {
      let root: string
      let proof: Buffer[]
      let proofFlags: boolean[]

      before(async function () {
        allValidators = depositData.map((item) => [
          `0x${item.pubkey}`,
          `0x${item.withdrawal_credentials}`,
          `0x${item.signature}`,
          `0x${item.deposit_data_root}`,
        ])
        validators = allValidators.slice(10, 60)

        const leaves = allValidators
          .map((v) => v[1])
          .map(ethers.utils.keccak256)
          .map((hash) => Buffer.from(hash.slice(2), 'hex'))
        const tree = new MerkleTree(leaves, ethers.utils.keccak256, { sortPairs: true, complete: true })
        root = tree.getHexRoot()

        const proofLeaves = validators
          .map((v) => v[1])
          .map(ethers.utils.keccak256)
          .map((hash) => Buffer.from(hash.slice(2), 'hex'))
        proof = tree.getMultiProof(proofLeaves)
        proofFlags = tree.getProofFlags(proofLeaves, proof)
      })

      it('batchDepositWithProof by owner should be ok', async function () {
        const depositAmount = ethers.utils.parseEther('32').mul(validators.length)
        await expect(slpDeposit.depositETH({ value: depositAmount }))
          .to.emit(slpDeposit, 'EthDeposited')
          .withArgs(deployer.address, depositAmount)
        expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(depositContract.address)).to.equal(0)

        await slpDeposit.setMerkleRoot(batchId, root)

        await slpDeposit.batchDepositWithProof(
          batchId,
          proof.map((buff) => `0x${buff.toString('hex')}`),
          proofFlags,
          validators
        )
        expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(0)
        expect(await ethers.provider.getBalance(depositContract.address)).to.equal(depositAmount)
      })

      it('batchDepositWithProof invalid proof should revert', async function () {
        await slpDeposit.setMerkleRoot(batchId, root)

        const invalidProof = proof.map((buff) => `0x${buff.toString('hex')}`)
        invalidProof[0] = '0x6f8b74eac672ae152dc2445ce1841d405bc19a1dac2a233939083f73815585bb'

        await expect(slpDeposit.batchDepositWithProof(batchId, invalidProof, proofFlags, validators)).to.revertedWith(
          'Merkle proof verification failed'
        )
      })

      it('batchDepositWithProof with low balance should revert', async function () {
        await slpDeposit.setMerkleRoot(batchId, root)

        await expect(
          slpDeposit.batchDepositWithProof(
            batchId,
            proof.map((buff) => `0x${buff.toString('hex')}`),
            proofFlags,
            validators
          )
        ).to.revertedWith('Insufficient balance')
      })

      it('batchDepositWithProof by attacker should revert', async function () {
        await slpDeposit.setMerkleRoot(batchId, root)

        await expect(
          slpDeposit.connect(attacker).batchDepositWithProof(
            batchId,
            proof.map((buff) => `0x${buff.toString('hex')}`),
            proofFlags,
            validators
          )
        ).to.revertedWith('Ownable: caller is not the owner')
      })

      it('batchDepositWithProof without merkle root should revert', async function () {
        await expect(
          slpDeposit.batchDepositWithProof(
            batchId,
            proof.map((buff) => `0x${buff.toString('hex')}`),
            proofFlags,
            validators
          )
        ).to.revertedWith('Merkle root not exists')
      })
    })
  })
})
