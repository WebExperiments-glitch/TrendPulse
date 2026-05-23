import React, { useState } from 'react';
import { MenuOutlined } from '@ant-design/icons';
import PopupMenu from './PopupMenu';
import './HamburgerMenu.css';

const HamburgerMenu = () => {
  const [visible, setVisible] = useState(false);

  const toggleMenu = () => {
    setVisible(!visible);
  };

  return (
    <div className="hamburger-container">
      <MenuOutlined 
        className="hamburger-icon"
        style={{ fontSize: '22px', cursor: 'pointer' }} 
        onClick={toggleMenu}
      />
      {visible && (
        <div className="menu-wrapper">
          <PopupMenu onClose={() => setVisible(false)} />
        </div>
      )}
    </div>
  );
};

export default HamburgerMenu;