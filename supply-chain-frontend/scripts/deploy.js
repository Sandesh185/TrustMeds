// @ts-ignore - Hardhat types not recognized by TS compiler
import { ethers } from "hardhat";
async function main() {
    console.log("Deploying DrugChain contract...");
    // Get the ContractFactory and Signers here.
    const DrugChain = await ethers.getContractFactory("DrugChain");
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
    // Deploy the contract
    const drugChain = await DrugChain.deploy();
    await drugChain.waitForDeployment();
    const contractAddress = await drugChain.getAddress();
    console.log("DrugChain deployed to:", contractAddress);
    // Save the contract address to a file for frontend use
    const fs = require('fs');
    const contractInfo = {
        address: contractAddress,
        abi: JSON.parse(JSON.stringify(DrugChain.interface.format()))
    };
    fs.writeFileSync('src/utils/contract-info.json', JSON.stringify(contractInfo, null, 2));
    console.log("Contract info saved to src/utils/contract-info.json");
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
