# 🔌 Plug&Code (v2.1.2)

**Plug&Code** is a **high-performance**, strongly-typed, **modular React framework**. It decouples **logic**, **UI**, and **data** via a **Feature-based architecture**.

> **New in v2.1.2:** Choose your path! Start instantly with **Simple Mode** (Zero Config) or scale massively with **Enterprise Mode** (Schema-Based).

---

## 🚀 Key Features

* **🛡️ Dual Mode:**
* **Simple:** Zero-boilerplate, inferred types, ideal for MVPs.
* **Enterprise:** Schema-first, strict contracts, Registry Pattern for large teams.


* **🧩 Feature-First Architecture:** Organize code in portable `ModuleManifests` that encapsulate state, logic, and UI.
* **⚡ Native Performance:** Built-in virtual rendering (`markVirtual`) and priority management via **Scheduler**.
* **🧠 Reactive State Machine:** Global & module-level state with **Immer** and granular subscriptions.
* **🎨 UI Composition Pipeline:** Slots system with **multiple injections**, **priorities**, and **keepAlive** support.
* **🛡️ Crash-Proof Slots:** Built-in **Error Boundaries** isolate every injected component. If one module crashes, the rest of the application stays alive.

---

## 📦 Installation

```bash
npm install plug-code immer
# or
yarn add plug-code immer

```

---

## ⚡ Mode A: Simple Mode (Zero Config)

Perfect for prototypes, small apps, or when you just need clean state management without complex architecture. Import from `plug-code/simple`.

### 1️⃣ Setup Store & Actions

Use `createSimplePlugC` to define your state. Types are inferred automatically from your initial state.

```tsx
// store.ts
import { createSimplePlugC } from 'plug-code/simple';

export const { Provider, useStore, useAction, createModule } = createSimplePlugC({
  initialState: {
    count: 0,
    user: { name: "Guest", loggedIn: false }
  },
  actions: {
    // Direct mutable updates with Immer draft
    increment: (draft) => { draft.count++ },
    login: (draft, name: string) => { 
      draft.user.name = name; 
      draft.user.loggedIn = true; 
    },
    // Async actions supported
    fetchData: async (draft) => {
       // ... logic
    }
  },
  options: { debug: true }
});

```

### 2️⃣ Use in Components

```tsx
// App.tsx
import { Provider, useStore, useAction } from './store';

const Counter = () => {
  const count = useStore(s => s.count); // Auto-typed as number
  const increment = useAction("increment");

  return <button onClick={() => increment()}>Count: {count}</button>;
}

export default () => (
  <Provider>
    <Counter />
  </Provider>
);

```

### 3️⃣ Modular Modules (The "Plug" Concept)

Need to encapsulate a module? Use `createModule` (returned from your store setup) to bundle State, View, and Logic into a portable unit.

```tsx
// modules/ChatFeature.tsx
import { createModule } from '../store'; // Import from YOUR store

export const ChatFeature = createModule({
  name: 'chat',
  state: { messages: [] as string[] },
  actions: {
    // Arguments: (draft, payload, rootActions)
    send: (draft, msg: string, root) => {
        draft.messages.push(msg);
        // You can even call root actions here:
        // root.increment(); 
    }
  },
  // Optional: Define a default View
  view: ({ state, actions }) => (
    <div>
      {state.messages.map(m => <div key={m}>{m}</div>)}
      <button onClick={() => actions.send("Hello!")}>Send</button>
    </div>
  )
});

// Usage inside App.tsx:
// <ChatFeature.View />

```

---

## 🛡️ Mode B: Enterprise Mode (Schema-Based)

For complex Dashboards, ERPs, or large teams. Define a strict **Schema Contract** to enforce architecture across the entire application.

### 1️⃣ The Type Schema

Define the shape of your application in a TypeScript object type.

```ts
// types/AppSchema.ts
export type AppSchema = {
  // 1. App State
  store: {
    "users:list": { id: string; name: string }[];
    "app:loading": boolean;
  };

  // 2. Commands (Payload -> Result)
  commands: {
    "users:delete": { payload: { id: string }; result: boolean };
    "data:fetch": { payload: void; result: void };
  };

  // 3. UI Slots (Props)
  slots: {
    "main-layout": {};
    "sidebar": { collapsed: boolean };
  };
};

```

### 2️⃣ Initialize the System

Pass your Schema to the factory. This returns **strongly-typed hooks** bound to your specific definitions.

```ts
// system.ts
import { createPlugC } from 'plug-code';
import type { AppSchema } from './types/AppSchema';

// ✨ MAGIC HAPPENS HERE: We pass the Schema to the factory
export const { 
    api, 
    SystemPlcRoot, 
    useStore, 
    useCommand, 
    useSlot 
} = createPlugC<AppSchema>();

```

### 3️⃣ Create a Feature Module

Modules use the typed hooks generated in the previous step.

```tsx
// modules/UsersFeature.tsx
import { ModuleManifest } from 'plug-code';
import { useStore, useCommand } from '../system'; // Import YOUR typed hooks

const UserList = () => {
  // TS knows "users:list" returns User[] automatically
  const users = useStore("users:list"); 
  const deleteCmd = useCommand("users:delete");

  return (
    <ul>
      {users.map(u => (
        <li key={u.id}>
          {u.name} 
          {/* TS enforces payload { id: string } */}
          <button onClick={() => deleteCmd({ id: u.id })}>x</button>
        </li>
      ))}
    </ul>
  );
};

export const UsersFeature: ModuleManifest = {
  name: "users",
  state: { "users:list": [] },
  commands: {
    "users:delete": ({ id }) => { console.log("Deleting", id); return true; }
  },
  slots: {
    "main-layout": [{ id: "user-list-view", component: UserList, priority: 10 }]
  },
  onLoad: () => {
    // Enable virtualization for large lists (10k+ items)
    api.markVirtual("main-layout", { itemHeight: 50 });
  }
};

```

### 4️⃣ Register & Render

Connect your modules to the main application using `api.registerModule`.

```tsx
// App.tsx
import React from 'react';
import { api, SystemPlcRoot } from './system'; // Singleton created in Step 2
import { UsersFeature } from './modules/UsersFeature';

// 🔌 Load the Feature into the runtime
// This initializes state, registers commands, and injects the UI into 'main-layout'
api.registerModule(UsersFeature);

export const App = () => {
  return (
    <SystemPlcRoot>
      <div className="layout-container">
        <h1>My Dashboard</h1>
        
        {/* Render the slot where UsersFeature injected its component */}
        <div className="content">
            {api.render("main-layout")}
        </div>
      </div>
    </SystemPlcRoot>
  );
};

```

---

## 📚 API Reference

Regardless of the mode, the `api` object exposes the full power of the Plug&Code runtime.

### 🧬 Root State Management

* **`createStore<K>(key, initial)`**
Initializes a key in the root store.
* **`getStore<K>(key)`**
Returns the current snapshot of a value in the root store.
* **`setStore<K>(key, updater, priority?, useTransition?)`**
Updates the state.
* `updater`: Can be a raw value or a callback `(draft) => void` (using **Immer**).
* `priority`: Execution priority (`HIGH`, `MED`, `LOW`).
* `useTransition`: Wraps the update in a React transition for concurrent mode.



### 📦 Feature State (Substores)

Methods to manage isolated state within modules (e.g., `"users:list"`).

* **`createSubstore<F, K>(substore, key, initial)`**
Initializes a specific key within a module namespace.
* **`getSubstore<F, K>(substore, key)`**
Gets a value from a module substore.
* **`setSubstore<F, K>(substore, key, updater, ...)`**
Updates a value in a module substore using Immer drafts.

### 🧠 Reactivity & Computed Values

* **`deriveStore(outputKey, outputSlot, dependencies, calculator)`**
Creates a **computed value** that automatically updates when dependencies change.
* **`deriveSubstore(substore, outputKey, outputSlot, dependencies, calculator)`**
Same as `deriveStore` but scoped to a specific module substore.
* **`watch(key, selector, callback)`**
Subscribes to changes in any store/substore key. Useful for side effects (logging, analytics).
* **`watchAllStores(definitions, callback)`**
Watches multiple keys across different stores/substores and triggers a callback when the combined state changes.

### ⚡ Logic & Commands

* **`registerCommand(id, fn)`**
Registers a global executable action.
* **`execute(id, payload)`**
Executes a registered command. Returns a typed `Promise`.
* **`wrapCommand(id, middleware)`**
Wraps an existing command with middleware (e.g., for validation or logging) without modifying the original logic.

### 🎨 UI Composition & Layout

* **`register(slot, id, component, priority, keepAlive)`**
Injects a React component into a UI Slot.
* `priority`: Higher numbers render first.
* `keepAlive`: If `true`, the DOM node is preserved (hidden) when removed from the view.


* **`render(slot, props)`**
Renders the content of a slot.
* **`wrap(slot, wrapper)`**
Applies a "Middleware Component" to an entire slot. Useful for injecting **Theme Providers**, **Suspense Boundaries**, or **Security Contexts** around a group of plugins.
```tsx
// Example: Wrap the entire dashboard sidebar in a ThemeProvider
api.wrap("sidebar", (children) => (
   <ThemeProvider theme={darkTheme}>
      {children}
   </ThemeProvider>
));

```


* **`after(slot, targetId, newId, component)`**
Injects a component immediately after a specific target ID within a slot.
* **`markVirtual(slot, config)`**
**High-Performance Mode:** Transforms the slot into a virtualized list.
* `config`: `{ itemHeight: number, overscan?: number }`.


* **`redraw(keyOrSlot)`**
Forces a re-render of a specific slot or store subscriber.
* **`connect(renderFn, dependencies)`**
HOC (Higher-Order Component) that connects a raw component to the store.

### 🔄 Data Pipeline (Transforms)

* **`makeTransform<T>(channel, id, fn, priority)`**
Registers a step in a data processing pipeline.
* **`getTransform<T>(channel, initialData, context)`**
Runs a pipeline asynchronously and returns the result. Caches results based on input equality.
* **`receive(channel, initialData, context)`**
Runs a synchronous pipeline. Throws if the pipeline contains async steps.

### 🧩 Modules & Lifecycle

* **`registerModule(manifest)`**
Loads a `ModuleManifest` (State, UI, Commands) into the runtime.
* **`loadFeature(importer)`**
Helper for lazy-loading modules (e.g., `() => import('./modules/MyFeature')`).
* **`createSelector(extractor, calculator)`**
Creates a memoized selector for use with hooks or watchers.

---

## 🛡️ Safety & Reliability

Plug&Code is built for stability. In large modular applications, a single buggy plugin shouldn't take down the entire dashboard.

### 🛑 Automatic Error Boundaries

Every component injected into a Slot is automatically wrapped in a `SlotErrorBoundary`.

* **Isolation:** If a module throws an error during render, only that specific slot item is replaced with a fallback error UI.
* **Logging:** Errors are caught and logged automatically, making debugging modular systems easier.

### 🚦 Concurrent Mode & Scheduler

The framework manages updates using an internal **Priority Scheduler** fully compatible with **React 18**.

* **Updates:** `setStore` supports `useTransition: true` to keep the UI responsive during heavy state updates.
* **Priorities:** You can schedule updates as `HIGH` (immediate interaction), `MED` (default), or `LOW` (background sync) to prevent frame drops.

---

## ⚡ Performance Internals

* **Virtualization:** `api.markVirtual` isn't just a helper; it swaps the rendering engine for that slot to a windowing system capable of handling **10,000+ items** with consistent frame rates.
* **Smart caching:** The `deriveStore` and pipeline `transform` systems use **Dependency Tracking** to only re-calculate when specific used keys change, avoiding zombie-child re-renders.

---

## 🌟 Best Practices (Enterprise Mode)

* **Schema First:** Define your data shape in `AppSchema` before coding.
* **Atomic Modules:** A module should contain all it needs (Store, UI, Commands).
* **Data-Driven UI:** Change the store, let watchers/hooks update the view.
* **Use Virtualization:** For large or growing lists, simply call `api.markVirtual` in `onLoad`.