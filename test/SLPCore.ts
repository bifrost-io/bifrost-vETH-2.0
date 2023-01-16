import { ethers } from 'hardhat'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

describe('SLPCore', function () {
  let depositContract: Contract
  let slpDeposit: Contract
  let slpCore: Contract
  let vETH1: Contract
  let vETH2: Contract
  let deployer: SignerWithAddress
  let newOwner: SignerWithAddress
  let operator: SignerWithAddress
  let newOperator: SignerWithAddress
  let attacker: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD'

  beforeEach(async function () {
    ;[deployer, newOwner, operator, newOperator, attacker, user1, user2] = await ethers.getSigners()

    const DepositContract = await ethers.getContractFactory('DepositContract')
    const VETH1 = await ethers.getContractFactory('vETH1')
    const VETH2 = await ethers.getContractFactory('vETH2')
    const SLPDeposit = await ethers.getContractFactory('SLPDeposit')
    const SLPCore = await ethers.getContractFactory('SLPCore')

    depositContract = await DepositContract.deploy()
    vETH1 = await VETH1.deploy()
    vETH2 = await VETH2.deploy()
    slpDeposit = await SLPDeposit.deploy()
    slpCore = await SLPCore.deploy()

    const initTokenPoolAmount = ethers.utils.parseEther('1')
    await vETH2.mint(deployer.address, initTokenPoolAmount)
    await slpDeposit.initialize(depositContract.address)
    await slpCore.initialize(
      vETH1.address,
      vETH2.address,
      slpDeposit.address,
      operator.address,
      ethers.utils.parseEther('1')
    )
    await vETH2.setOperator(slpCore.address)
    expect(await slpCore.tokenPool()).to.equal(initTokenPoolAmount)
    expect(await vETH2.totalSupply()).to.equal(initTokenPoolAmount)
  })

  it('basic check', async function () {
    expect(await slpCore.vETH1()).to.equal(vETH1.address)
    expect(await slpCore.vETH2()).to.equal(vETH2.address)
    expect(await slpCore.slpDeposit()).to.equal(slpDeposit.address)
    expect(await slpCore.operator()).to.equal(operator.address)
  })

  it('transfer owner should be ok', async function () {
    await slpCore.transferOwnership(newOwner.address)
    expect(await slpCore.owner()).to.equal(newOwner.address)
  })

  it('transfer owner by attacker should revert', async function () {
    await expect(slpCore.connect(attacker).transferOwnership(newOwner.address)).to.revertedWith(
      'Ownable: caller is not the owner'
    )
  })

  it('pause/unpause by owner should be ok', async function () {
    expect(await slpCore.paused()).to.equal(false)
    await slpCore.pause()
    expect(await slpCore.paused()).to.equal(true)
    await slpCore.unpause()
    expect(await slpCore.paused()).to.equal(false)
  })

  it('pause/unpause by attacker should revert', async function () {
    await expect(slpCore.connect(attacker).pause()).revertedWith('Ownable: caller is not the owner')
    await expect(slpCore.connect(attacker).unpause()).revertedWith('Ownable: caller is not the owner')
  })

  it('setOperator by owner should be ok', async function () {
    await slpCore.setOperator(newOperator.address)
    expect(await slpCore.operator()).to.equal(newOperator.address)
  })

  it('setOperator by attacker should revert', async function () {
    await expect(slpCore.connect(attacker).setOperator(newOperator.address)).to.revertedWith(
      'Ownable: caller is not the owner'
    )
  })

  describe('mint and renew', function () {
    beforeEach(async function () {
      await vETH2.transferOwnership(slpCore.address)
      await vETH1.mint(user1.address, ethers.utils.parseEther('100'))
      await vETH1.mint(user2.address, ethers.utils.parseEther('100'))
    })

    it('mint should be ok', async function () {
      const amount = ethers.utils.parseEther('1')
      await expect(slpCore.connect(user1).mint({ value: amount }))
        .to.emit(slpCore, 'Deposited')
        .withArgs(user1.address, amount, amount)
      expect(await vETH2.balanceOf(user1.address)).to.equal(amount)
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(amount)

      const amount2 = ethers.utils.parseEther('5')
      await expect(slpCore.connect(user1).mint({ value: amount2 }))
        .to.emit(slpCore, 'Deposited')
        .withArgs(user1.address, amount2, amount2)
      expect(await vETH2.balanceOf(user1.address)).to.equal(amount.add(amount2))
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(amount.add(amount2))
    })

    it('mint with zero amount should revert', async function () {
      const amount = ethers.utils.parseEther('0')
      await expect(slpCore.connect(user1).mint({ value: amount })).to.revertedWith('Zero amount')
    })

    it('mint when paused should revert', async function () {
      await slpCore.pause()
      const amount = ethers.utils.parseEther('1')
      await expect(slpCore.connect(user1).mint({ value: amount })).to.revertedWith('Pausable: paused')
    })

    it('renew should be ok', async function () {
      const amount = ethers.utils.parseEther('1')
      await vETH1.connect(user1).approve(slpCore.address, amount)
      await expect(slpCore.connect(user1).renew(amount))
        .to.emit(slpCore, 'Renewed')
        .withArgs(user1.address, amount, amount)
      expect(await vETH2.balanceOf(user1.address)).to.equal(amount)
      expect(await vETH1.balanceOf(DEAD_ADDRESS)).to.equal(amount)

      const amount2 = ethers.utils.parseEther('5')
      await vETH1.connect(user1).approve(slpCore.address, amount2)
      await expect(slpCore.connect(user1).renew(amount2))
        .to.emit(slpCore, 'Renewed')
        .withArgs(user1.address, amount2, amount2)
      expect(await vETH2.balanceOf(user1.address)).to.equal(amount.add(amount2))
      expect(await vETH1.balanceOf(DEAD_ADDRESS)).to.equal(amount.add(amount2))
    })

    it('renew with zero amount should revert', async function () {
      const amount = ethers.utils.parseEther('0')
      await expect(slpCore.connect(user1).renew(amount)).to.revertedWith('Zero amount')
    })

    it('renew when paused should revert', async function () {
      await slpCore.pause()
      const amount = ethers.utils.parseEther('1')
      await expect(slpCore.connect(user1).renew(amount)).to.revertedWith('Pausable: paused')
    })

    it('addReward should be ok', async function () {
      const reward = ethers.utils.parseEther('0.1')
      await slpCore.connect(operator).addReward(reward)
      expect(await slpCore.tokenPool()).to.equal(ethers.utils.parseEther('1.1'))
      expect(await vETH2.totalSupply()).to.equal(ethers.utils.parseEther('1'))

      const tokenAmount = ethers.utils.parseEther('1')
      const vTokenAmount = 909090909090909090n
      await expect(slpCore.connect(user1).mint({ value: tokenAmount }))
        .to.emit(slpCore, 'Deposited')
        .withArgs(user1.address, tokenAmount, vTokenAmount)
      expect(await vETH2.balanceOf(user1.address)).to.equal(vTokenAmount)
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(tokenAmount)

      await vETH1.connect(user2).approve(slpCore.address, tokenAmount)
      await expect(slpCore.connect(user2).renew(tokenAmount))
        .to.emit(slpCore, 'Renewed')
        .withArgs(user2.address, tokenAmount, vTokenAmount)
      expect(await vETH2.balanceOf(user2.address)).to.equal(vTokenAmount)
      expect(await vETH1.balanceOf(DEAD_ADDRESS)).to.equal(tokenAmount)
    })
  })
})
