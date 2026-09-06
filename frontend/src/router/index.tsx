import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import RequireRole from './RequireRole';

import Login from '../pages/common/Login';
import Register from '../pages/common/Register';

import AdminDashboard from '../pages/admin/Dashboard';
import CoachList from '../pages/admin/CoachList';
import CoachForm from '../pages/admin/CoachForm';
import ProductList from '../pages/admin/ProductList';
import ProductForm from '../pages/admin/ProductForm';
import PurchaseEntry from '../pages/admin/PurchaseEntry';
import CoachPurchaseQuery from '../pages/admin/CoachPurchaseQuery';
import BookingReviewList from '../pages/admin/BookingReviewList';
import BookingReviewDetail from '../pages/admin/BookingReviewDetail';
import GroupCourseList from '../pages/admin/GroupCourseList';
import CourseList from '../pages/admin/CourseList';
import CourseForm from '../pages/admin/CourseForm';
import CreateBooking from '../pages/admin/CreateBooking';
import Availability from '../pages/admin/Availability';
import MemberList from '../pages/admin/MemberList';
import MemberDetail from '../pages/admin/MemberDetail';
import SystemSettings from '../pages/admin/SystemSettings';

import Dashboard from '../pages/member/Dashboard';
import MyProducts from '../pages/member/MyProducts';
import MyBookings from '../pages/member/MyBookings';
import SubmitBooking from '../pages/member/SubmitBooking';
import AddPerson from '../pages/member/AddPerson';
import ChangePassword from '../pages/member/ChangePassword';

/**
 * 路由結構依「導覽結構與平台」章節確認之 6＋3 大類分組：
 * 每個側邊欄大類底下收合相關畫面（審核列表/詳情/建立預約同屬「預約審核」等）。
 */
export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },

  {
    element: <RequireRole role="admin" />,
    children: [
      {
        path: '/admin',
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <AdminDashboard /> },
          { path: 'reservations', element: <BookingReviewList /> },
          { path: 'reservations/create', element: <CreateBooking /> },
          { path: 'reservations/:id', element: <BookingReviewDetail /> },
          { path: 'coaches', element: <CoachList /> },
          { path: 'coaches/new', element: <CoachForm /> },
          { path: 'coaches/:id/edit', element: <CoachForm /> },
          { path: 'coaches/purchases', element: <CoachPurchaseQuery /> },
          { path: 'products', element: <ProductList /> },
          { path: 'products/new', element: <ProductForm /> },
          { path: 'products/:id/edit', element: <ProductForm /> },
          { path: 'products/purchase-entry', element: <PurchaseEntry /> },
          { path: 'courses', element: <GroupCourseList /> },
          { path: 'courses/new', element: <CourseForm /> },
          { path: 'courses/:id/edit', element: <CourseForm /> },
          { path: 'private-courses', element: <CourseList /> },
          { path: 'members', element: <MemberList /> },
          { path: 'members/:id', element: <MemberDetail /> },
          { path: 'slot-settings', element: <SlotSettings /> },
          { path: 'settings', element: <SystemSettings /> },
          { path: 'availability', element: <Availability /> },
        ],
      },
    ],
  },

  {
    element: <RequireRole role="member" />,
    children: [
      // 強制修改密碼頁：不套用 AppLayout（無側邊欄／導覽），完成修改前會員無法進入其他畫面
      { path: '/member/change-password', element: <ChangePassword /> },
      {
        path: '/member',
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'products', element: <MyProducts /> },
          { path: 'bookings', element: <MyBookings /> },
          { path: 'bookings/submit', element: <SubmitBooking /> },
          { path: 'bookings/:id/add-person', element: <AddPerson /> },
        ],
      },
    ],
  },

  { path: '*', element: <Navigate to="/login" replace /> },
]);
