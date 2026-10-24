import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import RequireRole from './RequireRole';

import Login from '../pages/common/Login';
import Register from '../pages/common/Register';

import AdminDashboard from '../pages/admin/Dashboard';
import CoachList from '../pages/admin/CoachList';
import CoachForm from '../pages/admin/CoachForm';
import CoachCourses from '../pages/admin/CoachCourses';
import CoachPayouts from '../pages/admin/CoachPayouts';
import ProductList from '../pages/admin/ProductList';
import ProductForm from '../pages/admin/ProductForm';
import PurchaseEntry from '../pages/admin/PurchaseEntry';
import PurchaseList from '../pages/admin/PurchaseList';
import CoachPurchaseQuery from '../pages/admin/CoachPurchaseQuery';
import BookingReviewList from '../pages/admin/BookingReviewList';
import BookingReviewDetail from '../pages/admin/BookingReviewDetail';
import GroupCourseList from '../pages/admin/GroupCourseList';
import GroupCourseArchive from '../pages/admin/GroupCourseArchive';
import CourseList from '../pages/admin/CourseList';
import CourseForm from '../pages/admin/CourseForm';
import CreateBooking from '../pages/admin/CreateBooking';
import Availability from '../pages/admin/Availability';
import MemberList from '../pages/admin/MemberList';
import MemberDetail from '../pages/admin/MemberDetail';
import SystemSettings from '../pages/admin/SystemSettings';

import MemberLayout from '../components/member/MemberLayout';
import MemberHome from '../pages/member/Home';
import Book from '../pages/member/Book';
import Me from '../pages/member/Me';
import CoachToday from '../pages/coach/Today';
import BuyProduct from '../pages/member/BuyProduct';
import MyProducts from '../pages/member/MyProducts';
import MyBookings from '../pages/member/MyBookings';
import SubmitBooking from '../pages/member/SubmitBooking';
import AddPerson from '../pages/member/AddPerson';
import ChangePassword from '../pages/member/ChangePassword';
import CoachAttendance from '../pages/coach/Attendance';
import MyPayouts from '../pages/coach/Payouts';

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
          { path: 'coaches/:id/courses', element: <CoachCourses /> },
          { path: 'coaches/purchases', element: <CoachPurchaseQuery /> },
          { path: 'coach-payouts', element: <CoachPayouts /> },
          { path: 'products', element: <ProductList /> },
          { path: 'products/new', element: <ProductForm /> },
          { path: 'products/:id/edit', element: <ProductForm /> },
          { path: 'products/purchase-entry', element: <PurchaseEntry /> },
          { path: 'purchases', element: <PurchaseList /> },
          { path: 'courses', element: <GroupCourseList /> },
          { path: 'courses/archived', element: <GroupCourseArchive /> },
          { path: 'courses/new', element: <CourseForm /> },
          { path: 'courses/:id/edit', element: <CourseForm /> },
          { path: 'courses/:id/duplicate', element: <CourseForm /> },
          { path: 'private-courses', element: <CourseList /> },
          { path: 'members', element: <MemberList /> },
          { path: 'members/:id', element: <MemberDetail /> },
          // { path: 'slot-settings', element: <SlotSettings /> },
          { path: 'settings', element: <SystemSettings /> },
          { path: 'availability', element: <Availability /> },
        ],
      },
    ],
  },

  {
    element: <RequireRole role="member" />,
    children: [
      // 修改密碼頁：不套用前台版面（無分頁列）；管理員要求強制修改時，完成前會員無法進入其他畫面
      { path: '/member/change-password', element: <ChangePassword /> },
      // 會員前台（品牌藍）：手機優先版面 + 底部分頁列
      {
        path: '/member',
        element: <MemberLayout mode="member" />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <MemberHome /> },
          { path: 'book', element: <Book /> },
          { path: 'purchase', element: <BuyProduct /> },
          { path: 'products', element: <MyProducts /> },
          { path: 'bookings', element: <MyBookings /> },
          // 舊的表單式預約（保留給特殊情況，例如場租），主要入口改為「預約課程」
          { path: 'bookings/submit', element: <SubmitBooking /> },
          { path: 'bookings/:id/add-person', element: <AddPerson /> },
          { path: 'me', element: <Me mode="member" /> },
          // 舊網址轉到教練前台
          { path: 'coaching', element: <Navigate to="/coach/attendance" replace /> },
          { path: 'payouts', element: <Navigate to="/coach/payouts" replace /> },
        ],
      },
      // 教練前台（深青綠）：僅綁定教練資料的會員可進入（MemberLayout 檢查）
      {
        path: '/coach',
        element: <MemberLayout mode="coach" />,
        children: [
          { index: true, element: <Navigate to="today" replace /> },
          { path: 'today', element: <CoachToday /> },
          { path: 'attendance', element: <CoachAttendance /> },
          { path: 'payouts', element: <MyPayouts /> },
          { path: 'me', element: <Me mode="coach" /> },
        ],
      },
    ],
  },

  { path: '*', element: <Navigate to="/login" replace /> },
]);
