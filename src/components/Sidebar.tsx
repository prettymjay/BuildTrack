import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../assets/DashBoard.css';

export default function Sidebar(): JSX.Element{
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  function handleLogout(){
    logout();
    navigate('/login');
  }

  return (
    <aside className="sidebar">
      <div className="brand">ProBuild Hardware</div>
      <nav>
        <ul>
          <li><NavLink to="/dashboard" className={({isActive}) => isActive ? 'active' : ''}>Dashboard</NavLink></li>
          <li><NavLink to="/projects" className={({isActive}) => isActive ? 'active' : ''}>Projects</NavLink></li>
          <li><NavLink to="/materials" className={({isActive}) => isActive ? 'active' : ''}>Materials</NavLink></li>
          <li><NavLink to="/expenses" className={({isActive}) => isActive ? 'active' : ''}>Expenses</NavLink></li>
          <li><NavLink to="/reports" className={({isActive}) => isActive ? 'active' : ''}>Reports</NavLink></li>
          <li><NavLink to="/settings" className={({isActive}) => isActive ? 'active' : ''}>Settings</NavLink></li>
        </ul>
      </nav>
      <div className="logout" onClick={handleLogout} role="button" tabIndex={0}>{user?.name ? `Logout (${user.name})` : 'Logout'}</div>
    </aside>
  )
}
