# 🔌 Plug&Code (v2)

**Plug&Code** is a high-performance, strongly-typed, modular React framework. It’s designed to build complex enterprise applications (like Dashboards, CRMs, ERPs) by decoupling logic, UI, and data through a Feature-based architecture.

**What's New in v2:** Full TypeScript support (Generics & Registry Pattern), native Virtualization, immutable state management with Immer, and lazy-loaded modules.

---

## 🚀 Key Features

- 🛡️ **Strong Typing:** Autocomplete and type inference in Stores, Commands, and Slots thanks to the Registry pattern.

- 🧩 **Feature-First Architecture:** Organize your code in portable `ModuleManifests` that encapsulate state, logic, and UI.

- ⚡ **Native Performance:** Built-in virtual rendering (`markVirtual`) and priority management with the Scheduler.

- 🧠 **Reactive State Machine:** Global and module-level state managed with Immer and granular subscriptions.

- 🎨 **UI Composition Pipeline:** Slot system with support for multiple injections, priorities, and `keepAlive`.

---

## 📦 Installation

```bash
npm install plug-code immer
# or
yarn add plug-code immer
🛡️ The Type Contract (Registry)
Unlike other frameworks, Plug&Code requires defining the “shape” of your app in a central file. This enables IntelliSense across the entire application.

Create a file types/registry.ts:

ts
Copiar código
// types/registry.ts
export type User = { id: string; name: string };

// 1. Define your State
export interface RootStoreRegistry {
  "users:list": User[];
  "app:loading": boolean;
}

// 2. Define your Commands (Payload -> Result)
export interface CommandRegistry {
  "users:add": { payload: User; result: void };
  "users:delete": { payload: { id: string }; result: boolean };
}

// 3. Define your UI Slots
export interface SlotRegistry {
  "main-layout": {};
  "sidebar": { collapsed: boolean };
}

// 4. Define Feature State
export interface FeatureRegistry {
  "auth": { token: string | null };
}
🚀 Quick Start
1️⃣ Create a Feature Module
Instead of loose functions, you now use a ModuleManifest object.

ts
Copiar código
// features/UsersFeature.tsx
import { ModuleManifest } from 'plug-code';
import { useCommand } from '../framework/plcHooks';

const UserList = () => {
  // Fully typed hook thanks to the Registry
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

  // Initial State
  state: {
    "users:list": []
  },

  // Commands (Logic)
  commands: {
    "users:delete": ({ id }) => {
       console.log("Deleting", id);
       return true;
    }
  },

  // UI Injection
  slots: {
    "main-layout": [
      { id: "user-list-view", component: UserList, priority: 10 }
    ]
  },

  // Advanced Initialization
  onLoad: (api) => {
      // Enable virtualization if the list grows
      api.markVirtual("main-layout", { itemHeight: 50 });
  }
};
2️⃣ Initialize the System
ts
Copiar código
// main.tsx
import { PlcStore, PlcAPI, PlcProvider } from 'plug-code';
import { UsersFeature } from './features/UsersFeature';

// 1. Instantiate Core
const store = new PlcStore();
const api = new PlcAPI(store);

// 2. Register Modules
api.registerModule(UsersFeature);

// 3. Render App
const App = () => (
  <PlcProvider api={api}>
     <div className="app">
        {/* Render the Main Slot */}
        {api.render("main-layout")}
     </div>
  </PlcProvider>
);
📚 API Reference
🧬 State Management (api)
createStore<K>(key, initial): Initializes a key in the root store.

setStore<K>(key, updater, priority?, useTransition?): Updates state using Immer. Supports React 18 concurrency.

getStore<K>(key): Gets a snapshot of the state.

watch<K>(key, selector, callback): Listen to reactive changes outside components.

🎨 UI & Layout (api.layout)
register(slot, id, component, priority, keepAlive): Inject a component into a slot.

priority: Higher number = higher placement.

keepAlive: Keeps the component in memory (hidden DOM) when changing views.

render(slot, props): Render a slot's content.

markVirtual(slot, config): Transform a normal slot into a high-performance virtual list (supports 10k+ items).

🧠 Logic & Commands
registerCommand(id, fn): Register a globally executable function.

execute(id, payload): Execute a command and return a typed Promise.

wrapCommand(id, middleware): Intercept commands (useful for logs, confirmations, etc).

⚛️ React Hooks
useStore(key, selector): Reactive, selective state subscription.

useCommand(id): Get an executable command function.

useSlot(slot): Get a function to dynamically render a slot.

🌟 Best Practices
Define your types first: Everything starts in registry.ts. If it’s not there, it doesn’t exist.

Atomic Features: A feature should contain everything it needs (Store, UI, Commands).

Data-Driven UI: Don’t manipulate the UI directly. Change the Store and let Watchers or Hooks update the view.

Use Virtualization: For large or unbounded lists, use api.markVirtual in the feature’s onLoad.