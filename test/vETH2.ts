import { ethers } from 'hardhat'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

describe('vETH2', function () {
  let vETH2: Contract
  let deployer: SignerWithAddress
  let newOwner: SignerWithAddress
  let receiver: SignerWithAddress
  let attacker: SignerWithAddress

  beforeEach(async function () {
    ;[deployer, newOwner, receiver, attacker] = await ethers.getSigners()
    const VETH2 = await ethers.getContractFactory('vETH2')
    vETH2 = await VETH2.deploy()
  })

  it('basic check', async function () {
    expect(await vETH2.name()).to.equal('Voucher Ethereum 2.0')
    expect(await vETH2.symbol()).to.equal('vETH')
    expect(await vETH2.decimals()).to.equal(18)
    expect(await vETH2.owner()).to.equal(deployer.address)
  })

  it('transfer owner should be ok', async function () {
    await vETH2.transferOwnership(newOwner.address)
    expect(await vETH2.owner()).to.equal(newOwner.address)
  })

  it('transfer owner by attacker should revert', async function () {
    await expect(vETH2.connect(attacker).transferOwnership(newOwner.address)).to.revertedWith(
      'Ownable: caller is not the owner'
    )
  })

  it('mint by owner should be ok', async function () {
    const amount = ethers.utils.parseEther('10')
    await vETH2.mint(receiver.address, amount)
    expect(await vETH2.balanceOf(receiver.address)).to.equal(amount)
    expect(await vETH2.totalSupply()).to.equal(amount)
  })

  it('mint by attacker should revert', async function () {
    const amount = ethers.utils.parseEther('10')
    await expect(vETH2.connect(attacker).mint(receiver.address, amount)).revertedWith(
      'Ownable: caller is not the owner'
    )
  })

  it('pause/unpause by owner should be ok', async function () {
    expect(await vETH2.paused()).to.equal(false)
    await vETH2.pause()
    expect(await vETH2.paused()).to.equal(true)
    await vETH2.unpause()
    expect(await vETH2.paused()).to.equal(false)
  })

  it('pause/unpause by attacker should revert', async function () {
    await expect(vETH2.connect(attacker).pause()).revertedWith('Ownable: caller is not the owner')
    await expect(vETH2.connect(attacker).unpause()).revertedWith('Ownable: caller is not the owner')
  })

  it('transfer should be ok', async function () {
    const amount = ethers.utils.parseEther('10')
    await vETH2.mint(newOwner.address, amount)
    expect(await vETH2.balanceOf(newOwner.address)).to.equal(amount)
    expect(await vETH2.balanceOf(receiver.address)).to.equal(0)

    await vETH2.connect(newOwner).transfer(receiver.address, amount)
    expect(await vETH2.balanceOf(newOwner.address)).to.equal(0)
    expect(await vETH2.balanceOf(receiver.address)).to.equal(amount)
  })

  it('transferFrom should be ok', async function () {
    const amount = ethers.utils.parseEther('10')
    await vETH2.mint(newOwner.address, amount)
    expect(await vETH2.balanceOf(newOwner.address)).to.equal(amount)
    expect(await vETH2.balanceOf(receiver.address)).to.equal(0)

    await vETH2.connect(newOwner).approve(receiver.address, amount)
    await vETH2.connect(receiver).transferFrom(newOwner.address, receiver.address, amount)
    expect(await vETH2.balanceOf(newOwner.address)).to.equal(0)
    expect(await vETH2.balanceOf(receiver.address)).to.equal(amount)
  })

  it('transfer when paused should revert', async function () {
    const amount = ethers.utils.parseEther('10')
    await vETH2.mint(newOwner.address, amount)

    await vETH2.pause()
    await expect(vETH2.connect(newOwner).transfer(receiver.address, amount)).revertedWith('Pausable: paused')
    await vETH2.unpause()
    await vETH2.connect(newOwner).transfer(receiver.address, amount)
  })

  it('transferFrom when paused should revert', async function () {
    const amount = ethers.utils.parseEther('10')
    await vETH2.mint(newOwner.address, amount)

    await vETH2.pause()
    await vETH2.connect(newOwner).approve(receiver.address, amount)
    await expect(vETH2.connect(receiver).transferFrom(newOwner.address, receiver.address, amount)).revertedWith(
      'Pausable: paused'
    )
    await vETH2.unpause()
    await vETH2.connect(receiver).transferFrom(newOwner.address, receiver.address, amount)
  })
})
