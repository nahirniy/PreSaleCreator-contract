# Presale factory (Dexola Solidity Bootcamp)

## Overview

This repository contains the solution for the Dexola Solidity Bootcamp application task. This is an improvement of the solution of the test task.

## Smart Contracts

1. **ERC20 Token Contract**: SolarGreen is an ERC20 token with burning, minting, and address blacklisting capabilities. It provides standard token functionalities along with features for managing token supply and restricting transfers to blacklisted addresses, ensuring security and control over token operations.
2. **Presale Factory Contract**: The TokenSale contract enables the sale of SolarGreen tokens through USDT or Ethereum purchases, incorporating features for pricing, sale duration management, and token claims after vesting period. Additionally, it allows the contract owner to withdraw ETH, USDT, and tokens from the contract.

## Technologies Used

- **Solidity**: Smart contracts wrote in Solidity, a programming language specifically designed for Ethereum smart contracts.
- **OpenZeppelin Library**: Utilized for building secure and standard-compliant ERC20 tokens and Access Control roles.
- **Hardhat Framework**: Used for development, testing, and deployment of smart contracts.
- **Unit Tests**: Comprehensive unit tests wrote to ensure the functionality and security of the smart contracts.
- **Ethereum Sepolia Testnet**: Contracts deployed and tested on the Ethereum test network.
- **Chainlink Oracle**: For obtaining real-time ETH/USD price feeds

## Contracts Information

- _SolarGreen address:_ 0x1D938a36244a6497a0f8FFBe1fa0F48F199Acd7C
- _PresaleFactory address:_ 0xF83417D670A22888aDABe6AD8edb396C98B8a9c1
- _SolarGreen etherscan:_ [Etherscan link](https://sepolia.etherscan.io/address/0x1D938a36244a6497a0f8FFBe1fa0F48F199Acd7C#code)
- _PresaleFactory etherscan:_ [Etherscan link](https://sepolia.etherscan.io/address/0xF83417D670A22888aDABe6AD8edb396C98B8a9c1#code)

## How to Create presale?

1. Use the createPresale functions. You need to have a token that you want to sell, enter it as the first parameter (address).
2. Then enter the initial time of the token sale and the final time in seconds. Use this [site](https://www.unixtimestamp.com/) for convert time in seconds.
3. Next, enter the token price, the amount of tokens to sell, and the token limit per user. Enter the number of tokens in your-decimal!
4. Then enter decimal and end of vesting when tokens can be claimed.
5. Next, transfer the required amount of tokens to the contract. IMPORTANT This should be an amount equal to the amount of tokens to sell that you entered when creating the contract.
6. Then use the startSale function. Enter id your contract.
7. Enter the presale id, for this use presale (in the read contact section). And then see information about the presale. For example, a presale with id 1 has already been done

## How to Buy tokens?

1. Use the ethBuyHelper and usdtBuyHelper functions to calculate the required amount of ether or usdt to buy a certain number of tokens. Enter the number of tokens in your-decimal format and id your presale, the amount will also be returned in your-decimal format. (it's free, no gas)
2. If you want to buy tokens for the test dollar, you should go to this [link](https://sepolia.etherscan.io/address/0x1531bc5de10618c511349f8007c08966e45ce8ef#writeContract), then mint the amount of dollars and make an approval. In the approval, specify the TokenSale address. If you did, use the BuyWithUSDT function, add the number of zeros to your. And specify the amount of token and id your presale.
3. If you want to buy tokens for test ether. use the BuyWithETH function, add the number of zeros to your. And specify the amount of token and id your presale. In the payable field, enter the amount of ether required for the purchase. Don't worry about if you sent more ether than necessary excess will be returned.
4. After your transaction has been completed successfully, you can view your token balance in the checkUserBalance function, enter your wallet address there and id your presale. (it's free, no gas)
5. After vesting period you will be able to claim your tokens using the claimTokens function, enter your wallet address there. You can do it from any wallet, the main thing is to specify the address from which the tokens were bought and they will come to that wallet

## Running the Project

1. Clone the repository.
2. Install dependencies using `npm install`.
3. Compile the smart contracts using `npx hardhat compile`.
4. Run tests using `npx hardhat test`.
5. Deploy the contracts to the Ethereum testnet using `npx hardhat run scripts/deploy.ts --network sepolia`.

### Contact Information

For any inquiries or clarifications regarding this project, please contact [Telegram](https://t.me/nahirniy) or [Email](nahirniyy@gamil.com).

### Disclaimer

This project is for educational and testing purposes only. The deployed smart contracts on testnets should not be used in a production environment without proper auditing and security considerations.
