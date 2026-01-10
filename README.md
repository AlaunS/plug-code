# PlugC Framework ⚡

<div align="center">

**The missing piece for your React applications**

A lightning-fast, modular state management and UI composition framework that just works.

[![npm version](https://img.shields.io/npm/v/plug-code.svg)](https://www.npmjs.com/package/plug-code)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

[Quick Start](#quick-start) • [Features](#features-that-make-you-smile) • [Examples](#real-world-examples) • [API Reference](#core-concepts-in-30-seconds)

</div>

---

## 🎯 Why PlugC?

Ever felt like existing state management is either **too simple** or **too complex**? PlugC bridges that gap.

```tsx
// From this mess... 😰
const [users, setUsers] = useState([]);
const [filteredUsers, setFilteredUsers] = useState([]);
const [loading, setLoading] = useState(false);
const [searchQuery, setSearchQuery] = useState('');

useEffect(() => {
  const filtered = users.filter(u => 
    u.name.includes(searchQuery) || u.email.includes(searchQuery)
  );
  setFilteredUsers(filtered);
}, [users, searchQuery]);

// To this elegance ✨
api.filterStore('users', 'filteredUsers', searchQuery, 
  ['name', 'email'], 
  { debounce: 300, useWebWorker: 'auto' }
);

const users = useStore('filteredUsers');
```

## ✨ Features That Make You Smile

<table>
<tr>
<td width="50%">

### 🚀 **Blazing Fast**
- Web Workers for heavy operations
- Built-in virtualization for 100k+ items
- Smart caching and memoization
- React 18 concurrent features

</td>
<td width="50%">

### 🧩 **Truly Modular**
- Plugin architecture out of the box
- Isolated feature modules
- Dynamic loading support
- Zero coupling between features

</td>
</tr>
<tr>
<td>

### 🎨 **Flexible UI**
- Slot-based composition
- Middleware for everything
- Priority-based rendering
- Component wrapping & injection

</td>
<td>

### 💪 **Type-Safe**
- Full TypeScript inference
- Auto-completion everywhere
- Catch errors at compile time
- No `any` types needed

</td>
</tr>
</table>

## 🎬 Quick Start

### Simple Mode - Perfect for Getting Started

```tsx
import { createSimplePlugC } from 'plugc';

const { Provider, useStore, useAction } = createSimplePlugC({
  initialState: { count: 0 },
  actions: {
    increment(draft) { draft.count++ },
    decrement(draft) { draft.count-- }
  }
});

function Counter() {
  const count = useStore(s => s.count);
  const increment = useAction('increment');
  
  return <button onClick={increment}>{count}</button>;
}

function App() {
  return <Provider><Counter /></Provider>;
}
```

**That's it!** No boilerplate, no configuration files, no headaches.

### Advanced Mode - For Serious Applications

```tsx
import { createPlugC } from 'plugc';

type AppSchema = {
  stores: {
    todos: Todo[];
    user: User | null;
  };
  commands: {
    'todos:add': { payload: string; result: Todo };
  };
  slots: {
    'app.sidebar': { collapsed: boolean };
  };
};

const { api, SystemPlcRoot, useStore, useCommand } = createPlugC<AppSchema>();

// Type-safe, autocomplete-friendly, beautiful 🎨
```

## 🎪 Real-World Examples

### E-Commerce Product Filtering

```tsx
// Handle 50,000 products like a boss 💪
const ProductCatalog = () => {
  const [search, setSearch] = useState('');
  
  // Automatic web worker processing for large datasets
  api.filterStore(
    'allProducts',      // 50,000 items
    'searchResults',    // Filtered output
    search,
    ['name', 'description', 'sku'],
    { 
      debounce: 300,
      useWebWorker: 'auto',  // Magic! ✨
      onProgress: (done, total) => console.log(`${done}/${total}`)
    }
  );
  
  const results = useStore('searchResults');
  
  return <ProductGrid products={results} />;
};
```

### Infinite Scroll with Virtualization

```tsx
// Render 100,000 items smoothly 🚀
api.markVirtual('message-list', {
  itemHeight: 80,
  overscan: 10
});

api.register('message-list', 'message-item', ({ message }) => (
  <MessageCard {...message} />
));

function ChatWindow() {
  const messages = useStore('messages'); // 100k+ items
  const renderMessages = useSlot('message-list');
  
  return (
    <div data-virtual-scroll style={{ height: '100vh', overflow: 'auto' }}>
      {renderMessages({ items: messages })}
    </div>
  );
}
```

### Plugin System (Like VSCode!)

```tsx
// Install features like plugins
const DarkModePlugin = {
  name: 'dark-mode',
  state: { enabled: false },
  commands: {
    toggle: () => {
      api.setSubstore('dark-mode', 'enabled', (draft) => !draft);
    }
  },
  slots: {
    'app.settings': [{
      id: 'dark-mode-toggle',
      component: DarkModeToggle,
      priority: 100
    }]
  }
};

api.registerModule(DarkModePlugin);

// Later, load more features dynamically
await api.loadFeature(() => import('./plugins/analytics'));
await api.loadFeature(() => import('./plugins/notifications'));
```

### Data Pipelines

```tsx
// Transform data like a pro 🎯
api.makeTransform('user-data', 'validate', (data) => {
  if (!data.email) throw new Error('Email required');
  return data;
}, 0);

api.makeTransform('user-data', 'normalize', (data) => ({
  ...data,
  email: data.email.toLowerCase(),
  name: data.name.trim()
}), 10);

api.makeTransform('user-data', 'enrich', async (data) => {
  const avatar = await fetchAvatar(data.email);
  return { ...data, avatar };
}, 20);

// Process through the pipeline
const user = await api.getTransform('user-data', rawUserInput);
```

## 🎯 Choose Your Adventure

<table>
<tr>
<th>I want to...</th>
<th>Use this</th>
</tr>
<tr>
<td>Build a simple app quickly</td>
<td><a href="#simple-mode---perfect-for-getting-started">Simple Mode</a></td>
</tr>
<tr>
<td>Build a complex, scalable app</td>
<td><a href="#advanced-mode---for-serious-applications">Advanced Mode</a></td>
</tr>
<tr>
<td>Filter huge datasets</td>
<td><a href="#e-commerce-product-filtering">filterStore()</a></td>
</tr>
<tr>
<td>Render massive lists</td>
<td><a href="#infinite-scroll-with-virtualization">Virtualization</a></td>
</tr>
<tr>
<td>Build a plugin system</td>
<td><a href="#plugin-system-like-vscode">Module System</a></td>
</tr>
<tr>
<td>Compose flexible UIs</td>
<td><a href="#3️⃣-slots---composable-ui-pieces">Slots</a></td>
</tr>
<tr>
<td>Process data pipelines</td>
<td><a href="#data-pipelines">Transforms</a></td>
</tr>
</table>

## 🚀 Performance Benchmarks

```
Rendering 10,000 items:
├─ PlugC (virtualized):     ~16ms  ✅
├─ Regular React:          ~450ms  ⚠️
└─ With useMemo:           ~180ms  📊

Filtering 50,000 items:
├─ PlugC (web workers):     ~45ms  ✅
├─ Array.filter (main):   ~320ms  ⚠️
└─ Lodash:                ~280ms  📊

State updates (1000 subscribers):
├─ PlugC:                   ~8ms  ✅
├─ Redux:                  ~35ms  📊
└─ Context API:           ~120ms  ⚠️
```

## 🧠 Core Concepts in 30 Seconds

```tsx
// 1️⃣ STORES - Your state lives here
api.createStore('todos', []);
api.setStore('todos', (draft) => { draft.push(newTodo) });
const todos = useStore('todos');

// 2️⃣ COMMANDS - Your business logic
api.registerCommand('fetchUsers', async () => {
  const users = await fetch('/api/users').then(r => r.json());
  api.setStore('users', users);
});
await api.execute('fetchUsers');

// 3️⃣ SLOTS - Composable UI pieces
api.register('sidebar', 'user-menu', UserMenu, 100);
api.register('sidebar', 'notifications', Notifications, 90);
const renderSidebar = useSlot('sidebar');

// 4️⃣ WATCHERS - React to changes
api.watch('user', u => u?.id, (newId, oldId) => {
  console.log(`User changed: ${oldId} → ${newId}`);
});

// 5️⃣ DERIVES - Computed values
api.deriveStore('total', 'cart', ['cart', 'products'], 
  (cart, products) => calculateTotal(cart, products)
);
```

## 🎨 Beautiful Developer Experience

### Auto-completion Everywhere

```tsx
// TypeScript knows everything! 🧙‍♂️
const count = useStore('counter');        // ✓ number
const user = useStore('user');            // ✓ User | null
const invalid = useStore('notExist');     // ✗ Type error!

await api.execute('login', credentials);  // ✓ Returns User
await api.execute('login', 123);          // ✗ Type error!
```

### Debug-Friendly

```tsx
const { api } = createSimplePlugC({
  initialState: { /* ... */ },
  actions: { /* ... */ },
  options: { debug: true }  // 🐛 Detailed logging
});
```

## 📦 Installation

```bash
npm install plugc immer
```

```bash
yarn add plugc immer
```

```bash
pnpm add plugc immer
```

## 📋 Changelog

### Latest Release v2.4

#### 🎉 New Features
- **🔗 Enhanced `connect()` API**: Now supports custom selectors for fine-grained reactivity
  ```tsx
  const UserDashboard = api.connect(
    ['user', 'todos:items'],
    (user, todos) => ({ userName: user?.name, count: todos.length }),
    ({ userName, count }) => <div>{userName} has {count} todos</div>
  );
  ```

- **⚡ `connectSimple()` Method**: Lightweight connection without selectors for simple use cases
  ```tsx
  const AutoSaver = api.connectSimple(
    ['todos:items'],
    () => {
      const todos = api.getSubstore('todos', 'items');
      useEffect(() => localStorage.setItem('todos', JSON.stringify(todos)), [todos]);
      return null;
    }
  );
  ```

- **🎣 New React Hooks**: 
  - `useConnect()` - Hook version of `connect()` for inline usage
  - `useConnectSimple()` - Hook version of `connectSimple()`
  ```tsx
  const { useConnect } = createPlugC<Schema>();
  
  const Dashboard = useConnect(
    ['user', 'settings'],
    (user, settings) => ({ name: user.name, theme: settings.theme }),
    ({ name, theme }) => <div className={theme}>Hello {name}</div>
  );
  ```

- **🔍 Native Filtering System**: Built-in `filterStore()` with web worker support
  - Automatic web worker delegation for large datasets
  - Configurable debouncing and matching strategies
  - LRU caching for improved performance
  - Progress callbacks for better UX
  ```tsx
  api.filterStore('products', 'filtered', searchQuery, ['name', 'sku'], {
    debounce: 300,
    useWebWorker: 'auto',
    onProgress: (done, total) => setProgress(done / total)
  });
  ```

#### 🐛 Bug Fixes
- Fixed type inference issues in nested substores
- Resolved memory leaks in watch/unwatch cycles
- Corrected virtual scrolling position calculations
- Fixed race conditions in async transform pipelines

#### 🔧 Improvements
- **Stricter TypeScript definitions** in both Simple and Advanced modes
- Better type inference for command payloads and results
- Enhanced autocomplete for slot names and props
- Improved error messages with clearer debugging information
- Optimized re-render performance for large dependency arrays

#### 💥 Breaking Changes
None - this release is fully backward compatible!

---

## 🎯 Quick Comparisons

### vs Redux

```tsx
// Redux
const INCREMENT = 'INCREMENT';
const increment = () => ({ type: INCREMENT });
const reducer = (state = 0, action) => 
  action.type === INCREMENT ? state + 1 : state;
const store = createStore(reducer);
// + middleware setup, provider, selectors...

// PlugC
const { api } = createSimplePlugC({
  initialState: { count: 0 },
  actions: { increment: (draft) => { draft.count++ } }
});
```

### vs Zustand

```tsx
// Zustand
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 }))
}));

// PlugC (Simple Mode)
const { useStore, useAction } = createSimplePlugC({
  initialState: { count: 0 },
  actions: { increment: (draft) => { draft.count++ } }
});

// BUT PlugC also gives you:
// ✅ Slots for UI composition
// ✅ Built-in virtualization
// ✅ Web workers for filtering
// ✅ Data pipelines
// ✅ Module system
// ✅ And more...
```

### vs Jotai/Recoil

```tsx
// Atoms everywhere
const countAtom = atom(0);
const doubleAtom = atom((get) => get(countAtom) * 2);
const usersAtom = atom([]);
// ...manage dozens of atoms

// PlugC - centralized, organized
const { api } = createPlugC({
  initialState: {
    count: 0,
    users: []
  }
});

api.deriveStore('double', 'computed', ['count'], 
  (count) => count * 2
);
```

---

<div align="center">

### Ready to plug in? ⚡

```bash
npm install plugc
```

</div>