// Smart Contract Tests using Hardhat
// Run with: npx hardhat test
import { expect } from "chai";
import { ethers } from "hardhat";
describe("DrugChain", function () {
    let drugChain;
    let owner;
    let manufacturer;
    let distributor;
    let customer;
    beforeEach(async function () {
        // Get signers
        [owner, manufacturer, distributor, customer] = await ethers.getSigners();
        // Deploy contract
        const DrugChainFactory = (await ethers.getContractFactory("DrugChain"));
        drugChain = await DrugChainFactory.deploy();
        await drugChain.waitForDeployment();
        // Authorize manufacturer
        await drugChain.connect(owner).authorizeManufacturer(manufacturer.address);
    });
    describe("Product Creation", function () {
        it("Should create a product", async function () {
            const productId = "PROD-001";
            const productName = "Test Drug";
            const manufacturerName = "Test Manufacturer";
            const productCode = "CODE-001";
            const category = "Pharmaceutical";
            const price = ethers.parseEther("1.0");
            const latitude = 12345678; // 12.345678 scaled
            const longitude = 98765432; // 98.765432 scaled
            await expect(drugChain.connect(manufacturer).createProduct(productId, manufacturerName, productName, productCode, category, price, latitude, longitude, 0, // expiryDate = 0 means no expiry
            "" // batchNumber
            )).to.emit(drugChain, "ProductCreated");
            const product = await drugChain.getProduct(productId);
            expect(product.productName).to.equal(productName);
            expect(product.manufacturerName).to.equal(manufacturerName);
            expect(product.currentOwner).to.equal(manufacturer.address);
        });
        it("Should reject product creation from unauthorized manufacturer", async function () {
            const unauthorized = await ethers.getSigner(customer.address);
            await expect(drugChain.connect(unauthorized).createProduct("PROD-002", "Unauthorized", "Test", "CODE-002", "Category", ethers.parseEther("1.0"), 0, 0, 0, "")).to.be.revertedWith("Not an authorized manufacturer");
        });
        it("Should reject duplicate product IDs", async function () {
            const productId = "PROD-003";
            // Create first product
            await drugChain.connect(manufacturer).createProduct(productId, "Manufacturer", "Product", "CODE-003", "Category", ethers.parseEther("1.0"), 0, 0, 0, "");
            // Try to create duplicate
            await expect(drugChain.connect(manufacturer).createProduct(productId, "Manufacturer", "Product 2", "CODE-004", "Category", ethers.parseEther("1.0"), 0, 0, 0, "")).to.be.revertedWith("Product already exists");
        });
    });
    describe("Ownership Transfer", function () {
        beforeEach(async function () {
            // Create a product first
            await drugChain.connect(manufacturer).createProduct("PROD-TRANSFER", "Manufacturer", "Transfer Product", "CODE-TRANSFER", "Category", ethers.parseEther("1.0"), 0, 0, 0, "");
        });
        it("Should transfer ownership", async function () {
            const productId = "PROD-TRANSFER";
            const latitude = 12345678;
            const longitude = 98765432;
            await expect(drugChain.connect(manufacturer).transferOwnership(productId, distributor.address, "Transferred to Distributor", latitude, longitude)).to.emit(drugChain, "OwnershipTransferred");
            const product = await drugChain.getProduct(productId);
            expect(product.currentOwner).to.equal(distributor.address);
        });
        it("Should reject transfer from non-owner", async function () {
            await expect(drugChain.connect(customer).transferOwnership("PROD-TRANSFER", customer.address, "Status", 0, 0)).to.be.revertedWith("Only current owner can transfer");
        });
    });
    describe("Status Updates", function () {
        beforeEach(async function () {
            await drugChain.connect(manufacturer).createProduct("PROD-STATUS", "Manufacturer", "Status Product", "CODE-STATUS", "Category", ethers.parseEther("1.0"), 0, 0, 0, "");
        });
        it("Should update product status", async function () {
            const productId = "PROD-STATUS";
            const newStatus = "In Transit";
            const latitude = 12345678;
            const longitude = 98765432;
            await expect(drugChain.connect(manufacturer).updateStatus(productId, newStatus, latitude, longitude)).to.emit(drugChain, "StatusUpdated");
            const product = await drugChain.getProduct(productId);
            expect(product.status).to.equal(newStatus);
        });
        it("Should reject status update from non-owner", async function () {
            await expect(drugChain.connect(customer).updateStatus("PROD-STATUS", "Delivered", 0, 0)).to.be.revertedWith("Only current owner can update status");
        });
    });
    describe("Manufacturer Authorization", function () {
        it("Should authorize a manufacturer", async function () {
            const newManufacturer = await ethers.getSigner(ethers.Wallet.createRandom().address);
            await expect(drugChain.connect(owner).authorizeManufacturer(newManufacturer.address)).to.emit(drugChain, "ManufacturerAuthorized");
            const isAuthorized = await drugChain.authorizedManufacturers(newManufacturer.address);
            expect(isAuthorized).to.be.true;
        });
        it("Should only allow owner to authorize manufacturers", async function () {
            const newManufacturer = await ethers.getSigner(ethers.Wallet.createRandom().address);
            await expect(drugChain.connect(manufacturer).authorizeManufacturer(newManufacturer.address)).to.be.revertedWith("Only contract owner can authorize manufacturers");
        });
        it("Should revoke manufacturer authorization", async function () {
            await expect(drugChain.connect(owner).revokeManufacturerAuthorization(manufacturer.address)).to.emit(drugChain, "ManufacturerAuthorizationRevoked");
            const isAuthorized = await drugChain.authorizedManufacturers(manufacturer.address);
            expect(isAuthorized).to.be.false;
        });
    });
    describe("Product Verification", function () {
        beforeEach(async function () {
            await drugChain.connect(manufacturer).createProduct("PROD-VERIFY", "Manufacturer", "Verify Product", "CODE-VERIFY", "Category", ethers.parseEther("1.0"), 0, 0, 0, "");
        });
        it("Should verify authentic product", async function () {
            const verification = await drugChain.verifyProduct("PROD-VERIFY");
            expect(verification.isAuthentic).to.be.true;
            expect(verification.isValidManufacturer).to.be.true;
        });
        it("Should return false for non-existent product", async function () {
            const verification = await drugChain.verifyProduct("NONEXISTENT");
            expect(verification.existsOnChain).to.be.false;
        });
    });
});
