Dialog for confirmations and short forms — e.g. new member sign-up, cancel plan.
```jsx
<Modal open={open} title="新增會員" onClose={close} footer={<><Button onClick={close}>取消</Button><Button type="primary">確認</Button></>}>...</Modal>
```
