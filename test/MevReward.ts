import { ethers } from 'hardhat'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { time } from '@nomicfoundation/hardhat-network-helpers'

describe('MevReward', function () {
  let mevReward: Contract
  let deployer: SignerWithAddress
  let newOwner: SignerWithAddress
  let attacker: SignerWithAddress
  let rewardPayer: SignerWithAddress
  let rewardReceiver: SignerWithAddress
  let feeReceiver: SignerWithAddress
  let newRewardReceiver: SignerWithAddress

  beforeEach(async function () {
    ;[deployer, newOwner, attacker, rewardPayer, rewardReceiver, feeReceiver, newRewardReceiver] =
      await ethers.getSigners()

    const MevReward = await ethers.getContractFactory('MevReward')
    mevReward = await MevReward.deploy()
    const feeRate = 100
    await mevReward.initialize(feeRate, rewardReceiver.address)
  })

  it('basic check', async function () {
    const now = await time.latest()
    const reward = await mevReward.reward()
    expect(reward.total).to.equal(0)
    expect(reward.perDay).to.equal(0)
    expect(reward.paid).to.equal(0)
    expect(reward.pending).to.equal(0)
    expect(reward.lastPaidAt).to.equal(now)
    expect(reward.finishAt).to.equal(now)

    const fee = await mevReward.fee()
    expect(fee.feeRate).to.equal(100)
    expect(fee.totalFee).to.equal(0)
    expect(fee.claimedFee).to.equal(0)

    expect(await mevReward.rewardReceiver()).to.equal(rewardReceiver.address)
    expect(await mevReward.FEE_RATE_DENOMINATOR()).to.equal(10000)
    expect(await mevReward.REWARD_DURATION()).to.equal(30)
    expect(await mevReward.REWARD_DURATION_DAYS()).to.equal(time.duration.days(30))
  })

  it('transfer owner should be ok', async function () {
    await mevReward.transferOwnership(newOwner.address)
    expect(await mevReward.owner()).to.equal(newOwner.address)
  })

  it('transfer owner by attacker should revert', async function () {
    await expect(mevReward.connect(attacker).transferOwnership(newOwner.address)).to.revertedWith(
      'Ownable: caller is not the owner'
    )
  })

  it('setFeeRate should be ok', async function () {
    const newFeeRate = 200
    await mevReward.setFeeRate(newFeeRate)
    const fee = await mevReward.fee()
    expect(fee.feeRate).to.equal(newFeeRate)
  })

  it('setFeeRate by attacker should revert', async function () {
    const newFeeRate = 200
    await expect(mevReward.connect(attacker).setFeeRate(newFeeRate)).revertedWith('Ownable: caller is not the owner')
  })

  it('setFeeRate exceeds range should revert', async function () {
    const newFeeRate = 10001
    await expect(mevReward.setFeeRate(newFeeRate)).revertedWith('Fee rate exceeds range')
  })

  describe('send reward', function () {
    it('send reward no overlap should be ok', async function () {
      const amount = ethers.utils.parseEther('1')
      await expect(
        rewardPayer.sendTransaction({
          to: mevReward.address,
          value: amount,
        })
      )
        .to.emit(mevReward, 'RewardReceived')
        .withArgs(rewardPayer.address, amount)

      let now = await time.latest()
      let reward = await mevReward.reward()
      let fee = await mevReward.fee()
      expect(reward.total).to.equal(ethers.utils.parseEther('0.99'))
      expect(reward.perDay).to.equal(ethers.utils.parseEther('0.033'))
      expect(reward.paid).to.equal(0)
      expect(reward.pending).to.equal(0)
      expect(reward.lastPaidAt).to.equal(BigNumber.from(now).div(time.duration.days(1)).mul(time.duration.days(1)))
      expect(reward.finishAt).to.equal(reward.lastPaidAt.add(time.duration.days(30)))
      expect(fee.totalFee).to.equal(ethers.utils.parseEther('0.01'))
      expect(fee.claimedFee).to.equal(0)

      const day = 31
      await time.increase(time.duration.days(day))
      await expect(
        rewardPayer.sendTransaction({
          to: mevReward.address,
          value: amount,
        })
      )
        .to.emit(mevReward, 'RewardReceived')
        .withArgs(rewardPayer.address, amount)

      now = await time.latest()
      reward = await mevReward.reward()
      fee = await mevReward.fee()
      expect(reward.total).to.equal(ethers.utils.parseEther('0.99').mul(2))
      expect(reward.perDay).to.equal(ethers.utils.parseEther('0.033'))
      expect(reward.paid).to.equal(0)
      expect(reward.pending).to.equal(ethers.utils.parseEther('0.033').mul(30))
      expect(reward.lastPaidAt).to.equal(BigNumber.from(now).div(time.duration.days(1)).mul(time.duration.days(1)))
      expect(reward.finishAt).to.equal(reward.lastPaidAt.add(time.duration.days(30)))
      expect(fee.totalFee).to.equal(ethers.utils.parseEther('0.01').mul(2))
      expect(fee.claimedFee).to.equal(0)
    })

    it('send reward overlap should be ok', async function () {
      const amount = ethers.utils.parseEther('1')
      await expect(
        rewardPayer.sendTransaction({
          to: mevReward.address,
          value: amount,
        })
      )
        .to.emit(mevReward, 'RewardReceived')
        .withArgs(rewardPayer.address, amount)

      let now = await time.latest()
      let reward = await mevReward.reward()
      let fee = await mevReward.fee()
      expect(reward.total).to.equal(ethers.utils.parseEther('0.99'))
      expect(reward.perDay).to.equal(ethers.utils.parseEther('0.033'))
      expect(reward.paid).to.equal(0)
      expect(reward.pending).to.equal(0)
      expect(reward.lastPaidAt).to.equal(BigNumber.from(now).div(time.duration.days(1)).mul(time.duration.days(1)))
      expect(reward.finishAt).to.equal(reward.lastPaidAt.add(time.duration.days(30)))
      expect(fee.totalFee).to.equal(ethers.utils.parseEther('0.01'))
      expect(fee.claimedFee).to.equal(0)

      const day = 15
      await time.increase(time.duration.days(day))
      await expect(
        rewardPayer.sendTransaction({
          to: mevReward.address,
          value: amount,
        })
      )
        .to.emit(mevReward, 'RewardReceived')
        .withArgs(rewardPayer.address, amount)

      now = await time.latest()
      reward = await mevReward.reward()
      fee = await mevReward.fee()
      expect(reward.total).to.equal(ethers.utils.parseEther('0.99').mul(2))
      expect(reward.perDay).to.equal(ethers.utils.parseEther('0.033').add(ethers.utils.parseEther('0.0165')))
      expect(reward.paid).to.equal(0)
      expect(reward.pending).to.equal(ethers.utils.parseEther('0.033').mul(day))
      expect(reward.lastPaidAt).to.equal(BigNumber.from(now).div(time.duration.days(1)).mul(time.duration.days(1)))
      expect(reward.finishAt).to.equal(reward.lastPaidAt.add(time.duration.days(30)))
      expect(fee.totalFee).to.equal(ethers.utils.parseEther('0.01').mul(2))
      expect(fee.claimedFee).to.equal(0)
    })

    it('send reward too low should revert', async function () {
      await expect(
        rewardPayer.sendTransaction({
          to: mevReward.address,
          value: 29,
        })
      ).revertedWith('Reward amount is too low')
    })
  })

  describe('payReward', function () {
    beforeEach(async function () {
      const amount = ethers.utils.parseEther('1')
      await expect(
        rewardPayer.sendTransaction({
          to: mevReward.address,
          value: amount,
        })
      )
        .to.emit(mevReward, 'RewardReceived')
        .withArgs(rewardPayer.address, amount)
    })

    it('payReward per day should be ok', async function () {
      // no reward
      await expect(mevReward.payReward())
        .to.emit(mevReward, 'RewardPaid')
        .withArgs(deployer.address, rewardReceiver.address, 0)
      let reward = await mevReward.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0'))
      expect(await rewardReceiver.getBalance()).to.equal(ethers.utils.parseEther('10000'))

      // pay reward
      for (let i = 0; i < 30; i++) {
        await time.increase(time.duration.days(1))
        await expect(mevReward.payReward())
          .to.emit(mevReward, 'RewardPaid')
          .withArgs(deployer.address, rewardReceiver.address, ethers.utils.parseEther('0.033'))
      }
      reward = await mevReward.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0.99'))
      expect(await rewardReceiver.getBalance()).to.equal(ethers.utils.parseEther('10000.99'))

      // no reward
      await time.increase(time.duration.days(1))
      await expect(mevReward.payReward())
        .to.emit(mevReward, 'RewardPaid')
        .withArgs(deployer.address, rewardReceiver.address, 0)
      reward = await mevReward.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0.99'))
      expect(await rewardReceiver.getBalance()).to.equal(ethers.utils.parseEther('10000.99'))
    })

    it('payReward per 10 day should be ok', async function () {
      // no reward
      await expect(mevReward.payReward())
        .to.emit(mevReward, 'RewardPaid')
        .withArgs(deployer.address, rewardReceiver.address, 0)
      let reward = await mevReward.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0'))
      expect(await rewardReceiver.getBalance()).to.equal(ethers.utils.parseEther('10000.99'))

      // pay reward
      for (let i = 0; i < 3; i++) {
        await time.increase(time.duration.days(10))
        await expect(mevReward.payReward())
          .to.emit(mevReward, 'RewardPaid')
          .withArgs(deployer.address, rewardReceiver.address, ethers.utils.parseEther('0.33'))
      }
      reward = await mevReward.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0.99'))
      expect(await rewardReceiver.getBalance()).to.equal(ethers.utils.parseEther('10001.98'))

      // no reward
      await time.increase(time.duration.days(1))
      await expect(mevReward.payReward())
        .to.emit(mevReward, 'RewardPaid')
        .withArgs(deployer.address, rewardReceiver.address, 0)
      reward = await mevReward.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0.99'))
      expect(await rewardReceiver.getBalance()).to.equal(ethers.utils.parseEther('10001.98'))
    })

    it('payReward one time should be ok', async function () {
      // no reward
      await expect(mevReward.payReward())
        .to.emit(mevReward, 'RewardPaid')
        .withArgs(deployer.address, rewardReceiver.address, 0)
      let reward = await mevReward.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0'))
      expect(await rewardReceiver.getBalance()).to.equal(ethers.utils.parseEther('10001.98'))

      // pay reward
      await time.increase(time.duration.days(100))
      await expect(mevReward.payReward())
        .to.emit(mevReward, 'RewardPaid')
        .withArgs(deployer.address, rewardReceiver.address, ethers.utils.parseEther('0.99'))
      reward = await mevReward.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0.99'))
      expect(await rewardReceiver.getBalance()).to.equal(ethers.utils.parseEther('10002.97'))

      // no reward
      await time.increase(time.duration.days(100))
      await expect(mevReward.payReward())
        .to.emit(mevReward, 'RewardPaid')
        .withArgs(deployer.address, rewardReceiver.address, 0)

      reward = await mevReward.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0.99'))
      expect(await rewardReceiver.getBalance()).to.equal(ethers.utils.parseEther('10002.97'))
    })

    it('payReward by attacker should revert', async function () {
      await expect(mevReward.connect(attacker).payReward()).revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('withdrawFee', function () {
    beforeEach(async function () {
      const amount = ethers.utils.parseEther('1')
      await expect(
        rewardPayer.sendTransaction({
          to: mevReward.address,
          value: amount,
        })
      )
        .to.emit(mevReward, 'RewardReceived')
        .withArgs(rewardPayer.address, amount)
    })

    it('withdrawFee should be ok', async function () {
      let fee = await mevReward.fee()
      expect(fee.totalFee).to.equal(ethers.utils.parseEther('0.01'))
      expect(fee.claimedFee).to.equal(0)
      expect(await feeReceiver.getBalance()).to.equal(ethers.utils.parseEther('10000'))

      const feeAmount = ethers.utils.parseEther('0.01')
      await expect(mevReward.withdrawFee(feeReceiver.address, feeAmount))
        .to.emit(mevReward, 'FeeWithdrawn')
        .withArgs(deployer.address, feeReceiver.address, feeAmount)

      fee = await mevReward.fee()
      expect(fee.totalFee).to.equal(ethers.utils.parseEther('0.01'))
      expect(fee.claimedFee).to.equal(ethers.utils.parseEther('0.01'))
      expect(await feeReceiver.getBalance()).to.equal(ethers.utils.parseEther('10000.01'))

      await expect(mevReward.withdrawFee(feeReceiver.address, 1)).revertedWith('Withdraw amount exceeds range')
    })

    it('withdrawFee with no amount should revert', async function () {
      await expect(mevReward.withdrawFee(feeReceiver.address, ethers.utils.parseEther('0.01').add(1))).revertedWith(
        'Withdraw amount exceeds range'
      )
    })
  })
})
