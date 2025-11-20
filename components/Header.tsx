import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="text-center mb-8 pt-10 sm:pt-4">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
        AI Fashion Studio By Tâm Thanh 22TH
      </h1>
      <p className="mt-3 text-base sm:text-lg text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
        Biến sự sáng tạo của bạn thành những bức ảnh lookbook chuyên nghiệp.
      </p>
    </header>
  );
};

export default Header;