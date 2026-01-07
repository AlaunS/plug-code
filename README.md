# 🔌 Plug&Code (v2)

**Plug&Code** is a **high-performance**, strongly-typed, **modular React framework**.
It’s designed for complex enterprise apps (Dashboards, CRMs, ERPs), decoupling **logic**, **UI**, and **data** via a **Feature-based architecture**.

> **v2 Highlights:** Zero-config TypeScript (Schema-based Factory), native virtualization, immutable state management with Immer, and lazy-loaded modules.

---

## 🚀 Key Features

* 🛡️ **Schema-Based Typing:** Define your app structure in a simple TS type and get **autocompletion instantly** in hooks and API methods.
* 🧩 **Feature-First Architecture:** Organize code in portable `ModuleManifests` that encapsulate **state**, **logic**, and **UI**.
* ⚡ **Native Performance:** Built-in virtual rendering (`markVirtual`) and priority management via **Scheduler**.
* 🧠 **Reactive State Machine:** Global & module-level state with **Immer** and granular subscriptions.
* 🎨 **UI Composition Pipeline:** Slots system with **multiple injections**, **priorities**, and **keepAlive** support.

---

## 📦 Installation

```bash
npm install plug-code immer
# or
yarn add plug-code immer

```

---

## 🛡️ The Type Schema

Forget about complex `declare module` augmentations. In v2, you simply define the shape of your application in a TypeScript object type.

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

---

## 🚀 Quick Start

### 1️⃣ Initialize the System

Use the `createPlugC` factory passing your Schema. This returns **strongly-typed hooks** bound to your specific application definitions.

```tsx
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

### 2️⃣ Create a Feature Module

Features use the typed hooks generated in the previous step.

```tsx
// features/UsersFeature.tsx
import { ModuleManifest } from 'plug-code';
import { useStore, useCommand } from '../system'; 

const UserList = () => {
  // TS knows "users:list" returns an array of users automatically
  const users = useStore("users:list"); 
  const deleteCmd = useCommand("users:delete");

  return (
    <ul>
      {users.map(u => (
        <li key={u.id}>
          {u.name} 
          {/* TS enforces the correct payload { id: string } */}
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
    "users:delete": ({ id }) => {
      console.log("Deleting", id);
      return true;
    }
  },
  slots: {
    "main-layout": [{ id: "user-list-view", component: UserList, priority: 10 }]
  },
  onLoad: (api) => {
    // Enable virtualization for large lists
    api.markVirtual("main-layout", { itemHeight: 50 });
  }
};

```

### 3️⃣ Render the App

```tsx
// App.tsx
import { api, SystemPlcRoot } from './system';
import { UsersFeature } from './features/UsersFeature';

// Load features
api.registerModule(UsersFeature);

const App = () => (
  <SystemPlcRoot>
    <div className="app">
      {/* Type-safe rendering */}
      {api.render("main-layout")}
    </div>
  </SystemPlcRoot>
);

```

## 📚 API Reference

The `api` object exposes the full power of the Plug&Code runtime.

### 🧬 Root State Management

Methods to interact with the global registry keys.

* **`createStore<K>(key, initial)`**
Initializes a key in the root store.
* **`getStore<K>(key)`**
Returns the current snapshot of a value in the root store.
* **`setStore<K>(key, updater, priority?, useTransition?)`**
Updates the state.
* `updater`: Can be a raw value or a callback `(draft) => void` (using **Immer**).
* `priority`: Execution priority (`HIGH`, `MED`, `LOW`).
* `useTransition`: Wraps the update in a React transition.


### 📦 Feature State (Substores)

Methods to manage isolated state within features (e.g., `"users:list"`).

* **`createSubstore<F, K>(substore, key, initial)`**
Initializes a specific key within a feature namespace.
* **`getSubstore<F, K>(substore, key)`**
Gets a value from a feature substore.
* **`setSubstore<F, K>(substore, key, updater, ...)`**
Updates a value in a feature substore using Immer drafts.

### 🧠 Reactivity & Computed Values

* **`deriveStore(outputKey, outputSlot, dependencies, calculator)`**
Creates a **computed value** that automatically updates when dependencies change.
* `outputKey`: The key where the result will be stored.
* `dependencies`: Array of store keys to listen to.
* `calculator`: Pure function `(...inputs) => result`.


* **`deriveSubstore(substore, outputKey, outputSlot, dependencies, calculator)`**
Same as `deriveStore` but scoped to a specific feature substore.
* **`watch(key, selector, callback)`**
Subscribes to changes in any store/substore key. useful for side effects (logging, analytics, etc).
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
Wraps a slot with a container component (e.g., adding a `div` or `ContextProvider` around all slot items).
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
Helper for lazy-loading features (e.g., `() => import('./features/MyFeature')`).
* **`createSelector(extractor, calculator)`**
Creates a memoized selector for use with hooks or watchers.
---

## 🌟 Best Practices

* **Schema First:** Define your data shape in `AppSchema` before coding.
* **Atomic Features:** A feature should contain all it needs (Store, UI, Commands).
* **Data-Driven UI:** Change the store, let watchers/hooks update the view.
* **Use Virtualization:** For large or growing lists, simply call `api.markVirtual` in `onLoad`.

---
