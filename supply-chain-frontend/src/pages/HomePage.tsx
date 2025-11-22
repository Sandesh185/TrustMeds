import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="text-center pt-8 pb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-6 flex flex-col items-center leading-tight">
          <span 
            className="text-7xl text-primary-600 font-extrabold" 
            style={{ 
              textShadow: '0 0 20px rgba(37, 99, 235, 0.5), 0 0 40px rgba(37, 99, 235, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)'
            }}
            aria-hidden="true"
          >
            +
          </span>
          <span>TrustMeds</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Track products from manufacturer to customer using blockchain technology 
          and QR code verification for complete transparency and authenticity.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/manufacturer" className="btn-primary">
            Get Started as Manufacturer
          </Link>
          <Link to="/customer" className="btn-secondary">
            Verify Product
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="pt-0 pb-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          How It Works
        </h2>
        <div className="grid md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-600 text-2xl font-bold">1</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Manufacturer</h3>
            <p className="text-gray-600">
              Create products with unique identifiers and generate QR codes for tracking.
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-600 text-2xl font-bold">2</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Distributor</h3>
            <p className="text-gray-600">
              Scan QR codes to verify ownership and transfer products in the supply chain.
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-600 text-2xl font-bold">3</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Delivery Hub</h3>
            <p className="text-gray-600">
              Confirm shipments and update product status in the blockchain.
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-600 text-2xl font-bold">4</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Customer</h3>
            <p className="text-gray-600">
              Scan QR codes to view complete product history and verify authenticity.
            </p>
          </div>
        </div>
      </div>

      {/* Role Selection */}
      <div className="py-16 bg-gray-100 rounded-lg">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Choose Your Role
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link
            to="/manufacturer"
            className="card hover:shadow-lg transition-shadow text-center"
          >
            <div className="text-4xl mb-4">🏭</div>
            <h3 className="text-xl font-semibold mb-2">Manufacturer</h3>
            <p className="text-gray-600">
              Create and register new products with blockchain verification.
            </p>
          </Link>
          
          <Link
            to="/distributor"
            className="card hover:shadow-lg transition-shadow text-center"
          >
            <div className="text-4xl mb-4">🚚</div>
            <h3 className="text-xl font-semibold mb-2">Distributor</h3>
            <p className="text-gray-600">
              Manage product transfers and ownership in the supply chain.
            </p>
          </Link>
          
          <Link
            to="/delivery-hub"
            className="card hover:shadow-lg transition-shadow text-center"
          >
            <div className="text-4xl mb-4">📦</div>
            <h3 className="text-xl font-semibold mb-2">Delivery Hub</h3>
            <p className="text-gray-600">
              Track shipments and update delivery status.
            </p>
          </Link>
          
          <Link
            to="/customer"
            className="card hover:shadow-lg transition-shadow text-center"
          >
            <div className="text-4xl mb-4">👤</div>
            <h3 className="text-xl font-semibold mb-2">Customer</h3>
            <p className="text-gray-600">
              Verify product authenticity and view complete history.
            </p>
          </Link>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Key Benefits
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="bg-success-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-success-600 text-2xl">🔒</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Blockchain Security</h3>
            <p className="text-gray-600">
              Immutable records ensure data integrity and prevent tampering.
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-success-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-success-600 text-2xl">📱</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">QR Code Tracking</h3>
            <p className="text-gray-600">
              Easy scanning for instant product verification and history access.
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-success-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-success-600 text-2xl">👁️</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Full Transparency</h3>
            <p className="text-gray-600">
              Complete visibility into product journey from creation to delivery.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
