import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();

  const owner = "0xEbd3C07d5dbef9091Db93BA718cF09a2DAFd4dE2";
  const usdt = "0x1531BC5dE10618c511349f8007C08966E45Ce8ef";
  const priceFeed = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

  const SolarGreen = await ethers.getContractFactory("SolarGreen", signer);
  const token = await SolarGreen.deploy(owner, owner);
  token.waitForDeployment();

  const PresaleFactory = await ethers.getContractFactory("PresaleFactory", signer);
  const presaler = await PresaleFactory.deploy(priceFeed, usdt, owner);
  presaler.waitForDeployment();

  const startTime = Math.floor(Date.now() / 1000) + 1800; // start time 30m from now
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

  const presaleId = await presaler.presaleId();

  await token.mint(presaler.target, availableTokens);
  await presaler.startSale(presaleId);

  console.log("SolarGreen address: ", token.target);
  console.log("PresaleFactory address: ", presaler.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
