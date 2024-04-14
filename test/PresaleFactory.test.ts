import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PresaleFactory", function () {
  async function deploy() {
    const [owner, buyer, spender] = await ethers.getSigners();

    const DECIMALS = "18";
    const INITIAL_PRICE = "360000000000"; // 3600$ ETH/USDT

    const mockV3AggregatorFactory = await ethers.getContractFactory("MockV3Aggregator");
    const mockV3Aggregator = await mockV3AggregatorFactory.deploy(DECIMALS, INITIAL_PRICE);
    mockV3Aggregator.waitForDeployment();

    const Tether = await ethers.getContractFactory("TestUSDT");
    const usdt = await Tether.deploy();
    usdt.waitForDeployment();

    const SolarGreen = await ethers.getContractFactory("SolarGreen", owner);
    const token = await SolarGreen.deploy(owner.address, owner.address);
    token.waitForDeployment();

    const PresaleFactory = await ethers.getContractFactory("PresaleFactory", owner);
    const presaler = await PresaleFactory.deploy(mockV3Aggregator.target, usdt.target, owner.address);
    presaler.waitForDeployment();

    const startTime = Math.floor(Date.now() / 1000) + 3600; // start time 1 hour from now
    const endTime = startTime + 3024000; // + 5 weeks
    const tokenPrice = ethers.parseUnits("7", 16); // 0.07$
    const availableTokens = ethers.parseUnits("50000000", 18);
    const limitPerUser = ethers.parseUnits("50000", 18);
    const precision = ethers.parseUnits("10", 18);
    const vestingEndTime = 1735682399; // Tue Dec 31 2024 23:59:59

    await presaler.createPresale(
      token.target,
      startTime,
      endTime,
      tokenPrice,
      availableTokens,
      limitPerUser,
      precision,
      vestingEndTime
    );

    await token.mint(presaler.target, availableTokens);

    return { owner, buyer, spender, presaler, usdt, token };
  }
  describe("Deployment presaler", function () {
    it("create presaler contract correct", async function () {
      const { owner, presaler } = await loadFixture(deploy);

      expect(await presaler.getAddress()).to.be.properAddress;
      expect(await presaler.owner()).to.be.eq(owner.address);
    });

    it("should revert if owner or oracle or usdt address is zero", async function () {
      const [owner] = await ethers.getSigners();
      const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
      const DECIMALS = "18";
      const INITIAL_PRICE = "360000000000"; // 3600$ ETH/USDT

      const mockV3AggregatorFactory = await ethers.getContractFactory("MockV3Aggregator");
      const mockV3Aggregator = await mockV3AggregatorFactory.deploy(DECIMALS, INITIAL_PRICE);
      mockV3Aggregator.waitForDeployment();

      const Tether = await ethers.getContractFactory("TestUSDT");
      const usdt = await Tether.deploy();
      usdt.waitForDeployment();

      const PresaleFactory = await ethers.getContractFactory("PresaleFactory", owner);
      await expect(PresaleFactory.deploy(ZERO_ADDRESS, usdt.target, owner.address)).to.be.revertedWith(
        "invalid oracle address"
      );
      await expect(
        PresaleFactory.deploy(mockV3Aggregator.target, ZERO_ADDRESS, owner.address)
      ).to.be.revertedWith("invalid USDT address");
      await expect(PresaleFactory.deploy(mockV3Aggregator.target, usdt.target, ZERO_ADDRESS)).to.be.reverted;
    });

    it("should revert if owner is a contract or oracle or usdt isnt contract", async function () {
      const [owner, user] = await ethers.getSigners();
      const DECIMALS = "18";
      const INITIAL_PRICE = "360000000000"; // 3600$ ETH/USDT

      const AnotherContract = await ethers.getContractFactory("TestUSDT");
      const anotherContract = await AnotherContract.deploy();
      anotherContract.waitForDeployment();

      const Tether = await ethers.getContractFactory("TestUSDT");
      const usdt = await Tether.deploy();
      usdt.waitForDeployment();

      const mockV3AggregatorFactory = await ethers.getContractFactory("MockV3Aggregator");
      const mockV3Aggregator = await mockV3AggregatorFactory.deploy(DECIMALS, INITIAL_PRICE);
      mockV3Aggregator.waitForDeployment();

      const PresaleFactory = await ethers.getContractFactory("PresaleFactory", owner);

      await expect(PresaleFactory.deploy(user.address, usdt.target, owner.address)).to.be.revertedWith(
        "oracle must be contract address"
      );
      await expect(
        PresaleFactory.deploy(mockV3Aggregator.target, user.address, owner.address)
      ).to.be.revertedWith("USDT must be contract address");
      await expect(
        PresaleFactory.deploy(mockV3Aggregator.target, usdt.target, anotherContract.target)
      ).to.be.revertedWith("owner cant be contract address");
    });
  });
  describe("createPresale", function () {
    const startTime = Math.floor(Date.now() / 1000) + 3600; // start time 1 hour from now
    const endTime = startTime + 3024000; // + 5 weeks
    const tokenPrice = ethers.parseUnits("7", 16); // 0.07$
    const availableTokens = ethers.parseUnits("50000000", 18);
    const limitPerUser = ethers.parseUnits("50000", 18);
    const precision = ethers.parseUnits("10", 18);
    const vestingEndTime = 1735682399; // Tue Dec 31 2024 23:59:59

    it("should revert if start time is not in the future", async function () {
      const { presaler, token } = await loadFixture(deploy);

      await expect(
        presaler.createPresale(
          token.target,
          0, // setting start time in the past
          endTime,
          tokenPrice,
          availableTokens,
          limitPerUser,
          precision,
          vestingEndTime
        )
      ).to.be.revertedWith("time isnt correct");
    });

    it("should revert if sale token address is zero", async function () {
      const { presaler } = await loadFixture(deploy);
      const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

      await expect(
        presaler.createPresale(
          ZERO_ADDRESS, // zero address for sale token
          startTime,
          endTime,
          tokenPrice,
          availableTokens,
          limitPerUser,
          precision,
          vestingEndTime
        )
      ).to.be.revertedWith("token address cant be zero");
    });

    it("should revert if sale token is not a contract", async function () {
      const { owner, presaler } = await loadFixture(deploy);

      await expect(
        presaler.createPresale(
          owner.address, // assuming owner is not a contract address
          startTime,
          endTime,
          tokenPrice,
          availableTokens,
          limitPerUser,
          precision,
          vestingEndTime
        )
      ).to.be.revertedWith("token must be contract address");
    });

    it("should revert if token price is zero", async function () {
      const { presaler, token } = await loadFixture(deploy);

      await expect(
        presaler.createPresale(
          token.target,
          startTime,
          endTime,
          0, // setting token price to zero
          availableTokens,
          limitPerUser,
          precision,
          vestingEndTime
        )
      ).to.be.revertedWith("token price cant be zero");
    });

    it("should revert if available tokens is zero", async function () {
      const { presaler, token } = await loadFixture(deploy);

      await expect(
        presaler.createPresale(
          token.target,
          startTime,
          endTime,
          tokenPrice,
          0, // setting available tokens to zero
          limitPerUser,
          precision,
          vestingEndTime
        )
      ).to.be.revertedWith("zero tokens to sell");
    });

    it("should revert if limit per user is zero", async function () {
      const { presaler, token } = await loadFixture(deploy);

      await expect(
        presaler.createPresale(
          token.target,
          startTime,
          endTime,
          tokenPrice,
          availableTokens,
          0, // setting limit per user to zero
          precision,
          vestingEndTime
        )
      ).to.be.revertedWith("zero tokens limit for user");
    });

    it("should revert if precision is zero", async function () {
      const { presaler, token } = await loadFixture(deploy);

      await expect(
        presaler.createPresale(
          token.target,
          startTime,
          endTime,
          tokenPrice,
          availableTokens,
          limitPerUser,
          0, // setting precision to zero
          vestingEndTime
        )
      ).to.be.revertedWith("precision cant be zero");
    });

    it("should revert if vesting end time is before sale end time", async function () {
      const { presaler, token } = await loadFixture(deploy);

      await expect(
        presaler.createPresale(
          token.target,
          startTime,
          endTime,
          tokenPrice,
          availableTokens,
          limitPerUser,
          precision,
          startTime - 1 // setting vesting end time before sale end time
        )
      ).to.be.revertedWith("vesting time end isnt correct");
    });

    it("should emit PresaleCreated event with correct parameters", async function () {
      const { presaler, token } = await loadFixture(deploy);

      const tx = await presaler.createPresale(
        token.target,
        startTime,
        endTime,
        tokenPrice,
        availableTokens,
        limitPerUser,
        precision,
        vestingEndTime
      );

      await expect(tx)
        .to.emit(presaler, "PresaleCreated")
        .withArgs(presaler.presaleId(), availableTokens, startTime, endTime, token.target);
    });
    it("should create a presale", async function () {
      const { presaler, token } = await loadFixture(deploy);

      await presaler.createPresale(
        token.target,
        startTime,
        endTime,
        tokenPrice,
        availableTokens,
        limitPerUser,
        precision,
        vestingEndTime
      );

      const presaleId = await presaler.presaleId();
      const presaleData = await presaler.presale(presaleId);

      expect(presaleData.saleToken).to.eq(token.target);
      expect(presaleData.startAt).to.eq(startTime);
      expect(presaleData.endsAt).to.eq(endTime);
      expect(presaleData.price).to.eq(tokenPrice);
      expect(presaleData.availableTokens).to.eq(availableTokens);
      expect(presaleData.limitPerUser).to.eq(limitPerUser);
      expect(presaleData.precision).to.eq(precision);
      expect(presaleData.vestingEndTime).to.eq(vestingEndTime);
      expect(presaleData.saleActive).to.eq(false);
      expect(presaleData.startSale).to.eq(false);
    });
  });
  describe("Presale functionality", function () {
    it("should start a presale", async function () {
      const { presaler } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();

      expect((await presaler.presale(presaleId)).startSale).to.be.false;

      await presaler.startSale(presaleId);

      expect((await presaler.presale(presaleId)).startSale).to.be.true;
    });
    it("should pause and unpause presale", async function () {
      const { presaler } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();
      await presaler.startSale(presaleId);

      await presaler.pausePresale(presaleId);
      expect((await presaler.presale(presaleId)).saleActive).to.be.false;

      await presaler.unPausePresale(presaleId);
      expect((await presaler.presale(presaleId)).saleActive).to.be.true;
    });

    it("cant pause and unpause presale if sale hasnt started or already paused/unpaused", async function () {
      const { presaler } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();

      await expect(presaler.unPausePresale(presaleId)).to.be.revertedWith("sale hasnt started yet");
      await expect(presaler.pausePresale(presaleId)).to.be.revertedWith("sale hasnt started yet");

      await presaler.startSale(presaleId);
      await expect(presaler.unPausePresale(presaleId)).to.be.revertedWith("not paused");
      await presaler.pausePresale(presaleId);
      await expect(presaler.pausePresale(presaleId)).to.be.revertedWith("already paused");
    });
    it("check presale balance", async function () {
      const { presaler } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();

      const tokenBalance = await presaler.presaleTokenBalance(presaleId);
      const availableToken = (await presaler.presale(presaleId)).availableTokens;

      expect(tokenBalance).to.eq(availableToken);
    });
    it("should update the token price", async function () {
      const { presaler } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();
      const newPrice = ethers.parseUnits("1", 18); // 1$

      await presaler.updateTokenPrice(presaleId, newPrice);

      const presaleData = await presaler.presale(presaleId);
      expect(presaleData.price).to.eq(newPrice);
    });

    it("should revert if new price is zero", async function () {
      const { presaler } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();
      const newPrice = ethers.parseUnits("0", 18); // 1$

      await expect(presaler.updateTokenPrice(presaleId, newPrice)).to.be.revertedWith("zero price");
    });
    it("should set the sale end time", async function () {
      const { presaler } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();
      const presaleData = await presaler.presale(presaleId);
      const newEndTime = presaleData.startAt + BigInt(86400); // + 1 day for end presale

      await presaler.setSaleEndTime(presaleId, newEndTime);

      const updateParesaleData = await presaler.presale(presaleId);
      expect(updateParesaleData.endsAt).to.eq(newEndTime);
    });

    it("should revert if new end time is before start time", async function () {
      const { presaler } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();
      const presaleData = await presaler.presale(presaleId);
      const invalidEndTime = presaleData.startAt - BigInt(86400); // - 1 day for end presale

      await expect(presaler.setSaleEndTime(presaleId, invalidEndTime)).to.be.revertedWith(
        "the end cant be before start"
      );
    });
    it("should set the vesting end time", async function () {
      const { presaler } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();
      const newVestingEndTime = (await presaler.presale(presaleId)).vestingEndTime + BigInt(86400); // + 1 day for vesting end presale

      await presaler.setVestingEndTime(presaleId, newVestingEndTime);

      const presaleData = await presaler.presale(presaleId);
      expect(presaleData.vestingEndTime).to.eq(newVestingEndTime);
    });

    it("should revert if new vesting end time is before sale end time", async function () {
      const { presaler } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();
      const invalidVestingEndTime = (await presaler.presale(presaleId)).endsAt - BigInt(86400); // - 1 day for end presale

      await expect(presaler.setVestingEndTime(presaleId, invalidVestingEndTime)).to.be.revertedWith(
        "vesting end cant be before the end sale"
      );
    });
  });
  describe("allow to buy tokens from current presale", function () {
    it("correct work function that canculate eth and usdt amount for token", async function () {
      const { presaler } = await loadFixture(deploy);

      const presaleId = await presaler.presaleId();
      const tokenPrice = ethers.parseUnits("7", 16); // 0.07$ per token
      const precision = ethers.parseUnits("10", 18);
      const tokenAmount = ethers.parseUnits("700", 18);
      const ethPrice = await presaler.getLatestPrice();

      const usdtAmount = (tokenAmount * tokenPrice) / precision;
      const ethAmount = (usdtAmount * precision) / ethPrice;

      expect(await presaler.usdtBuyHelper(presaleId, tokenAmount)).to.eq(usdtAmount);
      expect(await presaler.ethBuyHelper(presaleId, tokenAmount)).to.eq(ethAmount);
    });
    it("correct work of ustd, token, and ether balances", async function () {
      const { buyer, presaler, usdt, token } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();
      const tokenAmount = ethers.parseUnits("100", 18);
      const usdtAmount = await presaler.usdtBuyHelper(presaleId, tokenAmount);
      const ethAmount = await presaler.ethBuyHelper(presaleId, tokenAmount);
      const sumTokenAmount = tokenAmount + tokenAmount;
      const timeAfterStart = Number((await presaler.presale(presaleId)).startAt) + 1000;

      const txData = { value: ethAmount };

      await presaler.startSale(presaleId);

      await ethers.provider.send("evm_setNextBlockTimestamp", [timeAfterStart]);
      await ethers.provider.send("evm_mine");

      await usdt.connect(buyer).mint();
      await usdt.connect(buyer).approve(presaler.target, usdtAmount);
      await presaler.connect(buyer).buyWithUSDT(presaleId, tokenAmount);
      await presaler.connect(buyer).buyWithEth(presaleId, tokenAmount, txData);

      expect(await presaler.checkUserBalance(presaleId, buyer.address)).to.eq(sumTokenAmount);
      expect(await presaler.ethBalance()).to.eq(ethAmount);
      expect(await presaler.usdtBalance()).to.eq(usdtAmount);
      expect(await token.balanceOf(presaler.target)).to.eq(await presaler.presaleTokenBalance(presaleId)); // since token in the vesting
    });
    describe("Check main condition for purchase", function () {
      it("can't buy more than limit per user ", async function () {
        const { buyer, presaler } = await loadFixture(deploy);
        const presaleId = await presaler.presaleId();
        const tokenAmount = (await presaler.presale(presaleId)).limitPerUser + BigInt(1);
        const ethAmount = await presaler.ethBuyHelper(presaleId, tokenAmount);

        await presaler.startSale(presaleId);
        const timeAfterStart = Number((await presaler.presale(1)).startAt) + 1000;

        await ethers.provider.send("evm_setNextBlockTimestamp", [timeAfterStart]);
        await ethers.provider.send("evm_mine");

        const txData = { value: ethAmount };

        await expect(presaler.connect(buyer).buyWithEth(presaleId, tokenAmount, txData)).to.be.revertedWith(
          "cant buy more than limit per user"
        );
      });

      it("can't buy less than 1 token", async function () {
        const { buyer, presaler } = await loadFixture(deploy);
        const presaleId = await presaler.presaleId();
        const tokenAmount = 0;
        const ethAmount = await presaler.ethBuyHelper(presaleId, tokenAmount);

        await presaler.startSale(presaleId);
        const timeAfterStart = Number((await presaler.presale(1)).startAt) + 1000;

        await ethers.provider.send("evm_setNextBlockTimestamp", [timeAfterStart]);
        await ethers.provider.send("evm_mine");

        const txData = { value: ethAmount };

        await expect(presaler.connect(buyer).buyWithEth(presaleId, tokenAmount, txData)).to.be.revertedWith(
          "not enough funds!"
        );
      });

      it("can't buy token after end of token sale", async function () {
        const { buyer, presaler } = await loadFixture(deploy);
        const presaleId = await presaler.presaleId();
        const tokenAmount = ethers.parseUnits("30000", 18);
        const ethAmount = await presaler.ethBuyHelper(presaleId, tokenAmount);

        await presaler.startSale(presaleId);
        const timeAfterEnd = Number((await presaler.presale(1)).endsAt) + 1000;

        await ethers.provider.send("evm_setNextBlockTimestamp", [timeAfterEnd]);
        await ethers.provider.send("evm_mine");

        const txData = { value: ethAmount };

        await expect(presaler.connect(buyer).buyWithEth(presaleId, tokenAmount, txData)).to.be.revertedWith(
          "sale is not active"
        );
      });
    });
    it("allow to buy for Eth", async function () {
      const { buyer, presaler } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();
      const tokenAmount = ethers.parseUnits("100", 18);
      const ethAmount = await presaler.ethBuyHelper(presaleId, tokenAmount);

      const txData = { value: ethAmount };
      await presaler.startSale(presaleId);
      const timeAfterStart = Number((await presaler.presale(1)).startAt) + 1000;

      await ethers.provider.send("evm_setNextBlockTimestamp", [timeAfterStart]);
      await ethers.provider.send("evm_mine");

      const tx = await presaler.connect(buyer).buyWithEth(presaleId, tokenAmount, txData);
      tx.wait();

      expect(() => tx).to.changeEtherBalance(presaler, tokenAmount);
      expect(await presaler.checkUserBalance(presaleId, buyer.address)).to.eq(tokenAmount);
      expect(tx)
        .to.emit(presaler, "Bought")
        .withArgs(
          buyer.address,
          (await presaler.presale(presaleId)).saleToken,
          tokenAmount,
          Math.floor(Date.now() / 1000),
          presaleId
        );
    });

    it("allow to buy for USTD", async function () {
      const { buyer, presaler, usdt } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();
      const tokenAmount = ethers.parseUnits("100", 18);
      const usdtAmount = await presaler.usdtBuyHelper(presaleId, tokenAmount);

      await usdt.connect(buyer).mint();
      await usdt.connect(buyer).approve(presaler.target, usdtAmount);
      await presaler.startSale(presaleId);

      const timeAfterStart = Number((await presaler.presale(1)).startAt) + 1000;
      await ethers.provider.send("evm_setNextBlockTimestamp", [timeAfterStart]);
      await ethers.provider.send("evm_mine");

      const tx = await presaler.connect(buyer).buyWithUSDT(presaleId, tokenAmount);
      tx.wait();

      expect(await presaler.checkUserBalance(presaleId, buyer.address)).to.eq(tokenAmount);
      expect(await usdt.balanceOf(presaler.target)).to.equal(usdtAmount);
      expect(tx)
        .to.emit(presaler, "Bought")
        .withArgs(
          buyer.address,
          (await presaler.presale(presaleId)).saleToken,
          tokenAmount,
          Math.floor(Date.now() / 1000),
          presaleId
        );
    });
  });
  describe("Check token claim functionality", function () {
    it("can claim token after vesting period", async function () {
      const { buyer, presaler, token } = await loadFixture(deploy);

      const presaleId = await presaler.presaleId();

      const tokenAmount = ethers.parseUnits("100", 18);
      const ethAmount = await presaler.ethBuyHelper(presaleId, tokenAmount);
      const txData = { value: ethAmount };

      await presaler.startSale(presaleId);

      const timeAfterStart = Number((await presaler.presale(1)).startAt) + 1000;
      await ethers.provider.send("evm_setNextBlockTimestamp", [timeAfterStart]);
      await ethers.provider.send("evm_mine");

      const txBuy = await presaler.connect(buyer).buyWithEth(presaleId, tokenAmount, txData);
      txBuy.wait();

      const timeAfterVestingEnd = Number((await presaler.presale(1)).vestingEndTime) + 1000;
      await ethers.provider.send("evm_setNextBlockTimestamp", [timeAfterVestingEnd]);
      await ethers.provider.send("evm_mine");

      const txClaim = await presaler.claimToken(presaleId, buyer.address);
      txClaim.wait();

      expect(() => txBuy).to.changeEtherBalance(presaler, tokenAmount);
      expect(await presaler.checkUserBalance(presaleId, buyer.address)).to.eq(0);
      expect(await presaler.ethBalance()).to.eq(ethAmount);
      expect(await token.balanceOf(buyer.address)).to.eq(tokenAmount);
      expect(await token.balanceOf(presaler.target)).to.eq(
        (await presaler.presale(presaleId)).availableTokens
      );
      expect(txClaim)
        .to.emit(presaler, "Claimed")
        .withArgs(
          buyer.address,
          (await presaler.presale(presaleId)).saleToken,
          tokenAmount,
          Math.floor(Date.now() / 1000),
          presaleId
        );
    });

    it("cant claim token during vesting period", async function () {
      const { buyer, presaler } = await loadFixture(deploy);

      const presaleId = await presaler.presaleId();

      const tokenAmount = ethers.parseUnits("100", 18);
      const ethAmount = await presaler.ethBuyHelper(presaleId, tokenAmount);
      const txData = { value: ethAmount };

      const timeAfterStart = Number((await presaler.presale(1)).startAt) + 1000;
      await ethers.provider.send("evm_setNextBlockTimestamp", [timeAfterStart]);
      await ethers.provider.send("evm_mine");

      await presaler.startSale(presaleId);
      await presaler.connect(buyer).buyWithEth(presaleId, tokenAmount, txData);

      await expect(presaler.claimToken(presaleId, buyer.address)).to.be.revertedWith(
        "token claim will be allowed after vesting end"
      );
    });
    it("cant claim token if user balance less that 1", async function () {
      const { buyer, presaler } = await loadFixture(deploy);

      const presaleId = await presaler.presaleId();
      await presaler.startSale(presaleId);

      const timeAfterStart = Number((await presaler.presale(1)).startAt) + 1000;
      await ethers.provider.send("evm_setNextBlockTimestamp", [timeAfterStart]);
      await ethers.provider.send("evm_mine");

      const timeAfterVestingEnd = Number((await presaler.presale(1)).vestingEndTime) + 1000;
      await ethers.provider.send("evm_setNextBlockTimestamp", [timeAfterVestingEnd]);
      await ethers.provider.send("evm_mine");
      await expect(presaler.claimToken(presaleId, buyer.address)).to.be.revertedWith("zero claim amount");
    });
  });
  describe("Withdraw usdt, eth, token from contract", function () {
    it("only owner can withdraw ether from contract", async function () {
      const { owner, buyer, presaler } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();

      const tokenAmount = ethers.parseUnits("100", 18);
      const ethAmount = await presaler.ethBuyHelper(presaleId, tokenAmount);
      const txData = { value: ethAmount };

      const timeAfterStart = Number((await presaler.presale(1)).startAt) + 1000;
      await ethers.provider.send("evm_setNextBlockTimestamp", [timeAfterStart]);
      await ethers.provider.send("evm_mine");
      await presaler.startSale(presaleId);

      const txBuy = await presaler.connect(buyer).buyWithEth(presaleId, tokenAmount, txData);
      txBuy.wait();

      const beforeBalance = await ethers.provider.getBalance(owner.address);

      const txWithdraw = await presaler.connect(owner).withdrawETH(owner.address, ethAmount);
      txWithdraw.wait();

      const afterBalance = await ethers.provider.getBalance(owner.address);

      expect(await presaler.ethBalance()).to.eq(0);
      expect(beforeBalance).to.be.at.most(afterBalance);
      await expect(presaler.connect(owner).withdrawETH(owner.address, "1")).to.be.revertedWith(
        "insufficient ETH balance"
      );

      await presaler.connect(buyer).buyWithEth(presaleId, tokenAmount, txData);
      await expect(presaler.connect(buyer).withdrawETH(owner.address, ethAmount)).to.be.reverted;
    });

    it("only owner can withdraw usdt from contract", async function () {
      const { owner, buyer, presaler, usdt } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();

      const tokenAmount = ethers.parseUnits("100", 18);
      const usdtAmount = await presaler.usdtBuyHelper(presaleId, tokenAmount);

      await usdt.connect(buyer).mint();
      await usdt.connect(buyer).approve(presaler.target, usdtAmount * BigInt(2));
      const timeAfterStart = Number((await presaler.presale(1)).startAt) + 1000;
      await ethers.provider.send("evm_setNextBlockTimestamp", [timeAfterStart]);
      await ethers.provider.send("evm_mine");
      await presaler.startSale(presaleId);

      const txBuy = await presaler.connect(buyer).buyWithUSDT(presaleId, tokenAmount);
      txBuy.wait();

      const beforeBalance = await usdt.balanceOf(owner.address);

      const txWithdraw = await presaler.connect(owner).withdrawUSDT(owner.address, usdtAmount);
      txWithdraw.wait();

      const afterBalance = await usdt.balanceOf(owner.address);

      expect(await presaler.usdtBalance()).to.eq(0);
      expect(beforeBalance).to.be.at.most(afterBalance);
      await expect(presaler.connect(owner).withdrawUSDT(owner.address, "1")).to.be.revertedWith(
        "insufficient USDT balance"
      );

      await presaler.connect(buyer).buyWithUSDT(presaleId, tokenAmount);
      await expect(presaler.connect(buyer).withdrawUSDT(owner.address, usdtAmount)).to.be.reverted;
    });

    it("only owner can withdraw token from contract", async function () {
      const { owner, buyer, presaler, token } = await loadFixture(deploy);
      const presaleId = await presaler.presaleId();

      const tokenAmount = ethers.parseUnits("100", 18);
      const availableTokens = (await presaler.presale(presaleId)).availableTokens - BigInt(100);

      const beforeBalance = await presaler.presaleTokenBalance(presaleId);
      const beforeOwnerBalance = await token.balanceOf(owner.address);

      const txWithdraw = await presaler
        .connect(owner)
        .withdrawPresaleToken(presaleId, tokenAmount, owner.address);
      txWithdraw.wait();

      const afterBalance = await presaler.presaleTokenBalance(presaleId);
      const afterOwnerBalance = await token.balanceOf(owner.address);

      expect(afterBalance).to.eq(beforeBalance - tokenAmount);
      expect(afterOwnerBalance).to.eq(beforeOwnerBalance + tokenAmount);

      await expect(
        presaler.withdrawPresaleToken(presaleId, availableTokens, owner.address)
      ).to.be.revertedWith("insufficient token balance");
      await expect(presaler.connect(buyer).withdrawPresaleToken(presaleId, "1", owner.address)).to.be
        .reverted;
    });
  });
});
