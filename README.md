# 🔌 Plug&Code

**Plug&Code** is a multipurpose React framework designed for **scalability, reusability, and modular organization**.
It empowers developers to build complex applications by **plugging in independent feature modules** without tightly coupling the codebase.

> **License**
> You may use Plug&Code in personal or commercial projects.
> **Modification or redistribution of the framework source code is prohibited** without explicit permission.

---

## 📦 Installation

```bash
npm install plug-code
# or
yarn add plug-code
```

---

## 🧠 Core Concepts

Plug&Code is built around the **PLC (Pipeline–Logic–Command)** pattern combined with a specialized **Reactive State Machine**.

| Concept                 | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| **Features**            | Independent modules that encapsulate logic, UI, and data |
| **Stores (State)**      | Isolated substores with reactive linking                 |
| **Slots (UI Pipeline)** | Injection points for UI from any feature                 |
| **Commands (Logic)**    | Executable business actions with middleware              |
| **Transforms (Data)**   | Data pipelines modified by multiple features             |

---

## 🚀 Quick Start

### 1️⃣ Create a Feature Module

```ts
// features/PaginationFeature.ts
import type { PlcAPI } from 'plug-code';

export const PaginationFeature = (api: PlcAPI<any>) => {
  api.createData("pagination", { currentPage: 1, pageSize: 10, total: 0 });

  api.derive("activePage", ["pagination"], () => api.getData("pagination"));

  api.register("table-footer", (pageData) => {
    const { currentPage } = pageData;

    const goNext = () => api.update("pagination", d => { d.currentPage++ });

    return <button onClick={goNext}>Page {currentPage}</button>;
  }, "pagination");
};
```

---

### 2️⃣ Initialize the System

```ts
// system.ts
import { createPlugAndCode } from 'plug-code';
import { PaginationFeature } from './features/PaginationFeature';
import { SalesFeature } from './features/SalesFeature';

export const { useSystemPlc, SystemPlcRoot } = createPlugAndCode((api) => {
  api.createData("root", { appName: "My Dashboard", theme: "dark" });

  PaginationFeature(api);
  SalesFeature(api);
});
```

---

### 3️⃣ Wrap Your Application

```tsx
// App.tsx
import { useSystemPlc, SystemPlcRoot } from './system';

function App() {
  const { api, useSelector } = useSystemPlc({ mode: "production" });

  return (
    <SystemPlcRoot api={api}>
      <main>
        <h1>Welcome to {useSelector(s => s.root.appName)}</h1>
        <div className="footer-area">
          {api.render("table-footer")}
        </div>
      </main>
    </SystemPlcRoot>
  );
}
```

---

## 📚 API Reference

### 🧬 State & Reactivity

| Method                                  | Description              |
| --------------------------------------- | ------------------------ |
| `createData(key, initial)`              | Create a new store       |
| `getData(key)`                          | Get snapshot of store    |
| `update(key, updater, slot?, trigger?)` | Mutate store using Immer |
| `derive(target, deps, calc)`            | Create reactive linkage  |
| `watch(key, selector, cb)`              | Listen to store changes  |

---

### 🎨 UI Slots

| Method                               | Description          |
| ------------------------------------ | -------------------- |
| `register(slot, component, depKey?)` | Attach UI to slot    |
| `render(slot, props?)`               | Render slot pipeline |

---

### 🧠 Business Logic (Commands)

| Method                        | Description       |
| ----------------------------- | ----------------- |
| `registerCommand(id, fn)`     | Register action   |
| `execute(id, payload)`        | Run command       |
| `wrapCommand(id, middleware)` | Intercept command |

---

### 🔄 Data Transforms

| Method                            | Description   |
| --------------------------------- | ------------- |
| `send(channel, id, fn, priority)` | Add transform |
| `receive(channel, data)`          | Run pipeline  |

---

## 🌟 Best Practices

* Keep **one feature per file**
* Prefer `derive` over manual syncing
* Always specify `dependencyKey` in `register`
* Avoid putting everything in `root` — create focused stores

---