import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    // Prevent multiple submissions
    if (isLoading) return;
    
    // Validate inputs
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    
    // Clear any previous errors
    setError('');
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Perform real login
      const result = await login(email, password);
      if (result.success) {
        // Navigate to dashboard
        navigate('/dashboard', { replace: true });
      } else {
        setError(result.error || 'Login failed');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLogin();
  };

  return (
    <>
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
        }

        .login-container {  
          width: 100vw;
          height: 100vh;
          margin: 0;
          padding: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          position: fixed;
          top: 0;
          left: 0;
        }

        .login-background {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 25%, #e2e8f0 50%, #cbd5e1 75%, #94a3b8 100%);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          overflow: hidden;
        }

        .login-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.12) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(139, 92, 246, 0.08) 0%, transparent 60%),
            radial-gradient(circle at 90% 10%, rgba(236, 72, 153, 0.06) 0%, transparent 40%);
        }

        .login-overlay::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.05) 0%, transparent 25%),
            radial-gradient(circle at 75% 75%, rgba(16, 185, 129, 0.04) 0%, transparent 25%);
          animation: float 20s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }

        .login-card {
          background: linear-gradient(135deg, #ffffff 0%, #fefefe 50%, #fdfdfd 100%);
          backdrop-filter: blur(20px);
          border-radius: 20px;
          padding: 2rem 3rem;
          width: 100%;
          max-width: 550px;
          box-shadow: 
            0 25px 50px -12px rgba(0, 0, 0, 0.08),
            0 10px 25px -5px rgba(0, 0, 0, 0.04),
            0 0 0 1px rgba(255, 255, 255, 0.8);
          position: relative;
          z-index: 1;
          border: 1px solid rgba(148, 163, 184, 0.1);
        }

        .brand-header {
          text-align: center;
          margin-bottom: 1.5rem;
          position: relative;
        }

        .brand-logos {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 1rem;
        }

        .logo-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .logo-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .shopify-logo {
          background: linear-gradient(135deg, #7ab55c 0%, #95bf47 100%);
          color: white;
        }

        .analytics-logo {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
        }

        .logo-icon:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 12px -2px rgba(0, 0, 0, 0.15);
        }

        .logo-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .brand-title {
          font-size: 2.25rem;
          font-weight: 800;
          color:black;
          margin-bottom: 0.25rem;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .brand-subtitle {
          color: #64748b;
          font-size: 1rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          margin-bottom: 0.25rem;
        }

        .brand-description {
          color: #94a3b8;
          font-size: 0.85rem;
          font-weight: 400;
          font-style: italic;
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 0.25rem;
          letter-spacing: -0.025em;
        }

        .login-subtitle {
          color: #64748b;
          font-size: 0.95rem;
          font-weight: 500;
          letter-spacing: -0.01em;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .form-label {
          font-weight: 600;
          color: #374151;
          font-size: 0.95rem;
          letter-spacing: -0.01em;
        }

        .form-input {
          padding: 1rem;
          border: 2px solid #e2e8f0;
          border-radius: 14px;
          font-size: 1rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          background: linear-gradient(135deg, #ffffff 0%, #fefefe 100%);
          color: #1f2937;
          font-weight: 500;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 
            0 0 0 3px rgba(59, 130, 246, 0.12),
            0 4px 6px -1px rgba(0, 0, 0, 0.08);
          background: #ffffff;
        }

        .form-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: #f8fafc;
        }

        .form-input::placeholder {
          color: #9ca3af;
          font-weight: 400;
        }

        /* Style for email suggestions dropdown */
        input[list]::-webkit-calendar-picker-indicator {
          display: none !important;
        }
        
        datalist {
          position: absolute;
          background-color: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          max-height: 200px;
          overflow-y: auto;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .login-button {
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%);
          color: white;
          border: none;
          border-radius: 14px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 0.5rem;
          width: 100%;
          box-shadow: 
            0 4px 6px -1px rgba(59, 130, 246, 0.25),
            0 2px 4px -1px rgba(59, 130, 246, 0.15);
          letter-spacing: -0.01em;
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 
            0 10px 15px -3px rgba(59, 130, 246, 0.3),
            0 4px 6px -2px rgba(59, 130, 246, 0.2);
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%);
        }

        .login-button:active:not(:disabled) {
          transform: translateY(0);
          transition-duration: 0.1s;
        }

        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-message {
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
          color: #dc2626;
          padding: 1rem;
          border-radius: 12px;
          font-size: 0.95rem;
          border: 1px solid #fecaca;
          font-weight: 500;
          box-shadow: 0 1px 3px rgba(220, 38, 38, 0.1);
        }

        .login-footer {
          text-align: center;
          margin-top: 2rem;
        }

        .login-footer p {
          color: #64748b;
          font-size: 0.95rem;
          font-weight: 500;
        }
          .footer-highlight {
            color: #3b82f6;
            font-weight: 600;
      `}</style>

      <div className="login-container">
        <div className="login-background">
          <div className="login-overlay"></div>
          <div className="login-card">
            <div className="brand-header">
              <div className="brand-logos">
                <div className="logo-container">
                  <div className="logo-icon shopify-logo">
                    S
                  </div>
                  <span className="logo-label">Shopify</span>
                </div>
                <div style={{ 
                  width: '2px', 
                  height: '40px', 
                  background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)', 
                  borderRadius: '1px' 
                }}></div>
                <div className="logo-container">
                  <div className="logo-icon analytics-logo">
                    📊
                  </div>
                  <span className="logo-label">Analytics</span>
                </div>
              </div>
              
              <h1 className="brand-title">Xeno Analytics Board</h1>
                          </div>

            <div className="login-header">
              <h2 className="login-title">Welcome Back</h2>
              <p className="login-subtitle">Access your analytics dashboard</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={isLoading}
                  autoComplete="email"
                  list="email-suggestions"
                  name="email"
                  id="email"
                />
                
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>

              <button 
                type="submit"
                className="login-button"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="login-footer">
              <p>Built BY <span className="footer-highlight">Katherine Parshad</span></p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;