
# 🔌 Plug&Code (v2)

[![NPM Version](https://img.shields.io/npm/v/plug-code?color=blue)](https://www.npmjs.com/package/plug-code)
[![License](https://img.shields.io/npm/l/plug-code?color=green)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9-blue)](https://www.typescriptlang.org/)

**Plug&Code** is a **high-performance**, strongly-typed, **modular React framework**.  
It’s designed for complex enterprise apps (Dashboards, CRMs, ERPs), decoupling **logic**, **UI**, and **data** via a **Feature-based architecture**.

> **v2 Highlights:** Full TypeScript support (Generics & Registry Pattern), native virtualization, immutable state management with Immer, and lazy-loaded modules.

---

## 🚀 Key Features

- 🛡️ **Strong Typing:** Autocomplete and type inference in **Stores**, **Commands**, and **Slots** via the Registry pattern.
- 🧩 **Feature-First Architecture:** Organize code in portable `ModuleManifests` that encapsulate **state**, **logic**, and **UI**.
- ⚡ **Native Performance:** Built-in virtual rendering (`markVirtual`) and priority management via **Scheduler**.
- 🧠 **Reactive State Machine:** Global & module-level state with **Immer** and granular subscriptions.
- 🎨 **UI Composition Pipeline:** Slots system with **multiple injections**, **priorities**, and **keepAlive** support.

---

## 📦 Installation

<details>
<summary>Click to expand</summary>

```bash
npm install plug-code immer
# or
yarn add plug-code immer
````

</details>

---

## 🛡️ The Type Contract (Registry)

Plug&Code requires defining the **shape of your app** in a central registry file, enabling **IntelliSense** everywhere.

<details>
<summary>Example: types/registry.ts</summary>

```ts
export type User = { id: string; name: string };

// 1. App State
export interface RootStoreRegistry {
  "users:list": User[];
  "app:loading": boolean;
}

// 2. Commands (Payload -> Result)
export interface CommandRegistry {
  "users:add": { payload: User; result: void };
  "users:delete": { payload: { id: string }; result: boolean };
}

// 3. UI Slots
export interface SlotRegistry {
  "main-layout": {};
  "sidebar": { collapsed: boolean };
}

// 4. Feature State
export interface FeatureRegistry {
  "auth": { token: string | null };
}
```

</details>

---

## 🚀 Quick Start

### 1️⃣ Create a Feature Module

<details>
<summary>Example: UsersFeature</summary>

```ts
import { ModuleManifest } from 'plug-code';
import { useCommand, useStore } from '../framework/plcHooks';

const UserList = () => {
  const users = useStore("users:list", s => s); 
  const deleteCmd = useCommand("users:delete");

  return (
    <ul>
      {users.map(u => (
        <li key={u.id}>
          {u.name} <button onClick={() => deleteCmd({ id: u.id })}>x</button>
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
    api.markVirtual("main-layout", { itemHeight: 50 });
  }
};
```

</details>

---

### 2️⃣ Initialize the System

<details>
<summary>Example: main.tsx</summary>

```ts
import { PlcStore, PlcAPI, PlcProvider } from 'plug-code';
import { UsersFeature } from './features/UsersFeature';

const store = new PlcStore();
const api = new PlcAPI(store);

api.registerModule(UsersFeature);

const App = () => (
  <PlcProvider api={api}>
    <div className="app">
      {api.render("main-layout")}
    </div>
  </PlcProvider>
);
```

</details>

---

## 📚 API Reference

### 🧬 State Management (`api`)

* `createStore<K>(key, initial)`: Initialize a key in the root store.
* `setStore<K>(key, updater, priority?, useTransition?)`: Update state using **Immer**. Supports React 18 concurrency.
* `getStore<K>(key)`: Get a snapshot of the state.
* `watch<K>(key, selector, callback)`: Listen to reactive changes outside components.

### 🎨 UI & Layout (`api.layout`)

* `register(slot, id, component, priority, keepAlive)`: Inject a component in a slot.

  * `priority`: higher number = higher placement.
  * `keepAlive`: keeps the component in memory (hidden DOM) between view changes.
* `render(slot, props)`: Render slot content.
* `markVirtual(slot, config)`: Transform a slot into a **high-performance virtual list** (supports 10k+ items).

### 🧠 Logic & Commands

* `registerCommand(id, fn)`: Register a global command.
* `execute(id, payload)`: Execute a command and return a typed Promise.
* `wrapCommand(id, middleware)`: Intercept commands (logging, confirmation, etc).

### ⚛️ React Hooks

* `useStore(key, selector)`: Reactive, selective state subscription.
* `useCommand(id)`: Get an executable command function.
* `useSlot(slot)`: Render a slot dynamically.

---

## 🌟 Best Practices

* **Define types first:** Everything starts in `registry.ts`.
* **Atomic Features:** A feature should contain all it needs (Store, UI, Commands).
* **Data-Driven UI:** Change the store, let watchers/hooks update the view.
* **Use Virtualization:** For large or growing lists, call `api.markVirtual` in `onLoad`.

---