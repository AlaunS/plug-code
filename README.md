# Plug&Code

Plug&Code is a multipurpose framework for React designed for **scalability, reusability, and modular organization**. It allows you to build complex applications by "plugging in" features without tightly coupling your codebase.

## Usage

You are welcome to use Plug&Code in your projects, **personal or commercial**, as long as you **do not modify or redistribute the framework** without explicit permission from the author.

---

### Installation

Install the framework via npm or yarn:

```bash
npm install plug-code
# or
yarn add plug-code

```

### Core Concepts

Plug&Code is built around the **PLC (Pipeline-Logic-Command)** pattern:

* **Slots (UI Pipeline):** Inject components into pre-defined locations from any feature.
* **Commands (Logic):** Execute and wrap business actions (e.g., `checkout`, `print`, `save`).
* **Transforms (Data):** Pass data through named channels to be modified by different features.

---

### Quick Start Guide

#### 1. Initialize your System

Define your system and register features using the fluent API.

```tsx
import { createPlugAndCode } from 'plug-code';

export const { useSystemPlc, SystemPlcRoot } = createPlugAndCode((api) => {
  
  // Define a Sales Feature
  api.feature("sales", (api) => {
    // Register a UI component into a slot
    api.register("header.cart", () => <CartIcon />);

    // Register a business command
    api.registerCommand("sales.checkout", async (items) => {
      console.log("Saving items to database...", items);
      return { success: true };
    });
  });

  // Define a Logger Feature that wraps existing logic
  api.feature("logger", (api) => {
    api.wrapCommand("sales.checkout", (next) => async (items) => {
      console.log("Checkout started...");
      const result = await next(items);
      console.log("Checkout finished:", result);
      return result;
    });
  });
});

```

#### 2. Wrap your Application

Use the `useSystemPlc` hook to manage the state and `SystemPlcRoot` to provide the context.

```tsx
function App() {
  // Initialize state with initial properties
  const { api, useSelector } = useSystemPlc({ shopName: "My Store" });

  return (
    <SystemPlcRoot api={api}>
      <nav>
        {/* Render slots from any feature */}
        {api.render("header.cart")}
      </nav>
      <main>
        <h1>Welcome to {useSelector(s => s.root.shopName)}</h1>
      </main>
    </SystemPlcRoot>
  );
}

```

---

### API Reference

#### **UI Management (Slots)**

* `api.register(slotName, component)`: Adds a UI component to a slot.
* `api.render(slotName)`: Renders all components registered in that slot.
* `api.wrap(slot, wrapper)`: Wraps a slot's content with higher-order components.

#### **Business Logic (Commands)**

* `api.registerCommand(id, fn)`: Registers an executable action.
* `api.execute(id, payload)`: Runs a command and returns a Promise.
* `api.wrapCommand(id, (next) => ...)`: Intercepts a command to add side-effects or validations.

#### **Data Processing (Transforms)**

* `api.send(channel, id, fn, priority)`: Adds a data transformer to a specific channel.
* `api.receive(channel, initialData)`: Pipes data through all transformers in the channel.

#### **State Management**

* `useSelector(selector)`: Reactively listen to state changes.
* `api.update(key, updater)`: Update store data using Immer-powered drafts.
