import React, { useState } from 'react';
import { SparklesIcon } from './Icons';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    // Xóa các trường và lỗi khi chuyển chế độ
    setEmail('');
    setPassword('');
    setFullName('');
    setConfirmPassword('');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Logic giả lập
    setTimeout(() => {
      if (isRegisterMode) {
        // Logic đăng ký
        if (!fullName || !email || !password || !confirmPassword) {
          setError('Vui lòng điền đầy đủ thông tin.');
        } else if (password !== confirmPassword) {
          setError('Mật khẩu xác nhận không khớp.');
        } else {
          // Đăng ký thành công
          onLoginSuccess();
        }
      } else {
        // Logic đăng nhập
        if (email && password) {
          onLoginSuccess();
        } else {
          setError('Vui lòng nhập email và mật khẩu.');
        }
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm mx-auto bg-white/40 dark:bg-slate-800/60 backdrop-blur-xl p-8 rounded-2xl border border-white/50 dark:border-white/20 shadow-2xl animate-[slide-up-fade_0.5s_ease-out]">
        <div className="text-center mb-8">
            <div className="inline-block p-3 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full mb-4">
                 <SparklesIcon />
            </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isRegisterMode ? 'Tạo tài khoản mới' : 'Chào mừng tới AI Fashion Studio'}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {isRegisterMode ? 'Điền thông tin để bắt đầu.' : 'Đăng nhập để bắt đầu sáng tạo.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {isRegisterMode && (
             <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                >
                  Họ và tên
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên của bạn"
                  className="w-full p-3 bg-white/50 dark:bg-slate-700/50 border border-violet-300/50 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all duration-200 text-gray-800 dark:text-gray-200 placeholder-gray-500"
                />
            </div>
          )}
          
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nhập email của bạn"
              className="w-full p-3 bg-white/50 dark:bg-slate-700/50 border border-violet-300/50 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all duration-200 text-gray-800 dark:text-gray-200 placeholder-gray-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
            >
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isRegisterMode ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 bg-white/50 dark:bg-slate-700/50 border border-violet-300/50 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all duration-200 text-gray-800 dark:text-gray-200 placeholder-gray-500"
            />
          </div>

          {isRegisterMode && (
             <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                >
                  Xác nhận mật khẩu
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 bg-white/50 dark:bg-slate-700/50 border border-violet-300/50 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all duration-200 text-gray-800 dark:text-gray-200 placeholder-gray-500"
                />
            </div>
          )}

          {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{isRegisterMode ? 'Đang đăng ký...' : 'Đang đăng nhập...'}</span>
                </>
              ) : (
                isRegisterMode ? 'Đăng ký' : 'Đăng nhập'
              )}
            </button>
          </div>
        </form>
         <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          {isRegisterMode ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
          <button onClick={toggleMode} className="font-semibold text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300 focus:outline-none">
            {isRegisterMode ? 'Đăng nhập' : 'Đăng ký ngay'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
