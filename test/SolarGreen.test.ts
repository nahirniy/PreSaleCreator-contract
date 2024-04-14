import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("SolarGreen", function () {
  async function deploy() {
    const [owner, buyer, spender, newOwner] = await ethers.getSigners();

    const tokensForPurchase = ethers.parseUnits("50000000", 18);

    const SolarGreen = await ethers.getContractFactory("SolarGreen", owner);
    const token = await SolarGreen.deploy(owner.address, owner.address);

    token.mint(owner.address, tokensForPurchase);

    return { owner, buyer, spender, newOwner, token };
  }

  describe("Deployment", function () {
    it("create token contract correct", async function () {
      const { token, owner } = await loadFixture(deploy);

      const totalMintedToken = (await token.balanceOf(token.target)) + (await token.balanceOf(owner.address));

      expect(await token.totalSupply()).to.eq(totalMintedToken);
      expect(await token.getAddress()).to.be.properAddress;
      expect(await token.name()).to.be.eq("Solar Green");
      expect(await token.symbol()).to.be.eq("SGR");

      const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
      const BLACKLISTER_ROLE = await token.BLACKLISTER();
      expect(await token.hasRole(DEFAULT_ADMIN_ROLE, owner)).to.be.true;
      expect(await token.hasRole(BLACKLISTER_ROLE, owner)).to.be.true;
    });

    it("should revert if owner or blacklister address is zero", async function () {
      const [owner] = await ethers.getSigners();
      const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

      const SolarGreen = await ethers.getContractFactory("SolarGreen", owner);

      await expect(SolarGreen.deploy(ZERO_ADDRESS, owner.address)).to.be.revertedWith(
        "owner address isnt correct"
      );
      await expect(SolarGreen.deploy(owner.address, ZERO_ADDRESS)).to.be.revertedWith(
        "blacklister address isnt correct"
      );
    });

    it("should revert if owner or blacklister address is a contract", async function () {
      const [owner] = await ethers.getSigners();

      const AnotherContract = await ethers.getContractFactory("TestUSDT");
      const anotherContract = await AnotherContract.deploy();

      const SolarGreen = await ethers.getContractFactory("SolarGreen", owner);

      await expect(SolarGreen.deploy(anotherContract, owner.address)).to.be.revertedWith(
        "owner address cant be a contract"
      );
      await expect(SolarGreen.deploy(owner.address, anotherContract)).to.be.revertedWith(
        "blacklister cant be contract"
      );
    });
  });
  describe("Token functionality", function () {
    it("correct transfer from", async function () {
      const { owner, buyer, spender, token } = await loadFixture(deploy);

      const amount = ethers.parseUnits("8", 18);

      await token.approve(spender.address, amount);
      await token.connect(spender).transferFrom(owner.address, buyer.address, amount);

      const balanceBuyer = await token.balanceOf(buyer.address);

      expect(await token.allowance(owner.address, spender.address));
      expect(balanceBuyer).to.eq(amount);
    });

    it("allow to mint new token", async function () {
      const { owner, buyer, token } = await loadFixture(deploy);

      const amount = ethers.parseUnits("10", 18);
      const expectedTotalSupply = (await token.totalSupply()) + amount;

      const tx = await token.mint(owner.address, amount);

      expect(await token.totalSupply()).to.eq(expectedTotalSupply);
      await expect(token.connect(buyer).mint(owner.address, amount)).to.be.reverted;
      expect(tx).to.emit(token, "MintedNewToken").withArgs(owner.address, amount);
    });

    it("allow to burn token", async function () {
      const { token } = await loadFixture(deploy);

      const amount = ethers.parseUnits("8", 18);
      const expectedTotalSupply = (await token.totalSupply()) - amount;

      const tx = await token.burn(token.target, amount);

      expect(await token.totalSupply()).to.eq(expectedTotalSupply);
      expect(tx).to.emit(token, "BurnedToken").withArgs(token.target, amount);
    });

    it("only blacklister can add and remove address to blacklist", async function () {
      const { buyer: blacklister, spender, token } = await loadFixture(deploy);

      await expect(token.connect(spender).addBlacklister(blacklister.address)).to.be.reverted;
      await token.addBlacklister(blacklister.address);
      const firstTx = await token.connect(blacklister).addToBlacklist(spender.address);
      expect(firstTx).to.emit(token, "AddedToBlacklist").withArgs(spender.address);

      expect(await token.isBlacklisted(spender.address)).to.eq(true);

      const secondTx = await token.connect(blacklister).removeFromBlacklist(spender.address);
      expect(secondTx).to.emit(token, "removedFromBlacklist").withArgs(spender.address);

      expect(await token.isBlacklisted(spender.address)).to.eq(false);
    });

    it("only owner can add and remove a blacklister", async function () {
      const { owner, buyer: blacklister, token } = await loadFixture(deploy);

      await token.addBlacklister(blacklister.address);

      expect(await token.hasRole(await token.BLACKLISTER(), blacklister.address)).to.be.true;

      await token.removeBlacklister(blacklister.address);

      expect(await token.hasRole(await token.BLACKLISTER(), blacklister.address)).to.be.false;
      await expect(token.connect(blacklister).addBlacklister(owner.address)).to.be.reverted;
    });
  });

  describe("Terms and functionality of the blacklister and blacklist", async function () {
    it("should revert if blacklister address is invalid or contract or already exists", async function () {
      const { token, buyer: blacklister } = await loadFixture(deploy);
      const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
      const CONTRACT_ADDRESS = token.target;

      await token.addBlacklister(blacklister.address);

      await expect(token.addBlacklister(ZERO_ADDRESS)).to.be.revertedWith("blacklister address isnt correct");
      await expect(token.addBlacklister(blacklister.address)).to.be.revertedWith("already blacklister");
      await expect(token.addBlacklister(CONTRACT_ADDRESS)).to.be.revertedWith(
        "contract address cant be blacklister"
      );
    });
    it("should revert if account is already removed from blacklister", async function () {
      const { token, buyer: blacklister } = await loadFixture(deploy);

      await token.addBlacklister(blacklister.address);
      await token.removeBlacklister(blacklister.address);

      await expect(token.removeBlacklister(blacklister.address)).to.be.revertedWith(
        "doesnt have role blacklister"
      );
    });
    it("should revertif address is admon or blacklister or contract or already in bl", async function () {
      const { owner, token, buyer: blacklister } = await loadFixture(deploy);
      const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
      const CONTRACT_ADDRESS = token.target;

      await token.addBlacklister(blacklister.address);

      await expect(token.addToBlacklist(owner.address)).to.be.revertedWith("admin cant be in bl");
      await expect(token.addToBlacklist(blacklister.address)).to.be.revertedWith("blackister cant be in bl");
      await expect(token.connect(blacklister).addToBlacklist(CONTRACT_ADDRESS)).to.be.revertedWith(
        "contract address cant be in bl"
      );
      await expect(token.connect(blacklister).addToBlacklist(ZERO_ADDRESS)).to.be.revertedWith(
        "user address isnt correct"
      );
    });
    it("should revert if address isnt in blacklist", async function () {
      const { token, buyer: blacklister } = await loadFixture(deploy);

      await expect(token.removeFromBlacklist(blacklister.address)).to.be.revertedWith(
        "account isnt in the blacklist"
      );
    });

    it("user cant buy and transfer token if it is blacklisted", async function () {
      const { token, buyer } = await loadFixture(deploy);
      const amountToken = ethers.parseUnits("100", 18);

      await token.addToBlacklist(buyer.address);

      await expect(token.transfer(buyer.address, amountToken)).to.be.revertedWith("recipient is blocked");
    });
    it("cant transfer from token if it is blacklisted", async function () {
      const { owner, token, buyer, spender } = await loadFixture(deploy);
      const amountToken = ethers.parseUnits("100", 18);

      await token.addToBlacklist(buyer.address);

      await token.approve(spender.address, amountToken);

      await expect(
        token.connect(spender).transferFrom(owner.address, buyer.address, amountToken)
      ).to.be.revertedWith("recipient is blocked");
    });
  });
});
