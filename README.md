# Plug&Code 🔌

**Plug&Code** is a multipurpose React framework designed for **scalability, reusability, and modular organization**. It empowers developers to build complex applications by "plugging in" independent feature modules without tightly coupling the codebase.

> **License:** You are welcome to use Plug&Code in your personal or commercial projects. Modification or redistribution of the framework source code is prohibited without explicit permission.

---

## 📦 Installation

Install the framework via npm or yarn:

```bash
npm install plug-code
# or
yarn add plug-code
🧠 Core Concepts
Plug&Code is built around the PLC (Pipeline-Logic-Command) pattern combined with a specialized Reactive State Machine:

Features: Independent functions that encapsulate Logic, UI, and Data. No more monolithic configurations.

Stores (State): Isolated state containers (substores) that can be linked reactively.

Slots (UI Pipeline): Inject components into pre-defined locations from any feature.

Commands (Logic): Execute and wrap business actions (e.g., checkout, print) with middleware support.

Transforms (Data): Pass data through named channels to be modified by different features before rendering.

🚀 Quick Start Guide
1. Create a Feature Module
Define features in separate files. A feature is simply a function that receives the api.

TypeScript

// features/PaginationFeature.ts
import type { PlcAPI } from 'plug-code';

export const PaginationFeature = (api: PlcAPI<any>) => {
    // 1. Initialize State
    api.createData("pagination", { currentPage: 1, pageSize: 10, total: 0 });

    // 2. Reactive Linking (Derive)
    // Automatically update 'root.activePage' when 'pagination' changes
    api.derive("activePage", ["pagination"], () => api.getData("pagination"));

    // 3. Register UI Component
    // The 3rd argument ("pagination") subscribes this component to the store.
    api.register("table-footer", (pageData) => {
        const { currentPage } = pageData;
        
        // Use the extended update to modify data
        const goNext = () => api.update(
            "pagination",            // Store to update
            d => { d.currentPage++ } // Updater (Immer draft)
        );

        return <button onClick={goNext}>Page {currentPage}</button>;
    }, "pagination");
};
2. Initialize your System
Import your feature functions and inject them into the system.

TypeScript

// system.ts
import { createPlugAndCode } from 'plug-code';
import { PaginationFeature } from './features/PaginationFeature';
import { SalesFeature } from './features/SalesFeature';

export const { useSystemPlc, SystemPlcRoot } = createPlugAndCode((api) => {
    // Initialize global root data
    api.createData("root", { appName: "My Dashboard", theme: "dark" });

    // Install Features
    PaginationFeature(api);
    SalesFeature(api);
});
3. Wrap your Application
Use the hooks to provide context and render slots.

TypeScript

// App.tsx
import { useSystemPlc, SystemPlcRoot } from './system';

function App() {
  // Initialize system with props (synced to "root" store automatically)
  const { api, useSelector } = useSystemPlc({ mode: "production" });

  return (
    <SystemPlcRoot api={api}>
      <main>
        <h1>Welcome to {useSelector(s => s.root.appName)}</h1>
        
        {/* Render slots: The pipeline assembles all registered components */}
        <div className="footer-area">
            {api.render("table-footer")}
        </div>
      </main>
    </SystemPlcRoot>
  );
}
📚 API Reference
State Management & Reactivity
The framework uses an isolated store architecture with reactive capabilities using Immer.

api.createData(key, initialData)
Initializes a new substore.

key: Unique identifier (e.g., "pagination").

initialData: The starting object.

api.getData(key)
Imperatively retrieves the current snapshot of a store.

api.update(key, updater, [slot], [triggerKey])
Updates the state using Immer-powered drafts.

key: The store to update.

updater: (draft) => void. Mutate the draft directly.

slot (Optional): Name of the UI slot to invalidate (clears visual cache).

triggerKey (Optional): Name of another store to force-update (useful for manual dependency triggering without derive).

api.derive(targetKey, dependencies, calculator)
Creates a reactive link. When dependencies change, the target is recalculated automatically.

targetKey: Where to save the result.

dependencies: Array of store keys to listen to.

api.watch(key, selector, callback)
Listens for changes to perform side effects (logging, analytics, etc.).

UI Management (Slots)
api.register(slotName, componentFn, [dependencyKey])
Adds a component to a pipeline.

slotName: Where to inject the component.

componentFn: Function receiving data and returning JSX.

dependencyKey: The store key this component subscribes to. It triggers a re-render only when that specific store changes.

api.render(slotName, [props])
Renders the pipeline for the given slot name.

Business Logic (Commands)
api.registerCommand(id, fn): Registers an executable action.

api.execute(id, payload): Runs a command and returns a Promise.

api.wrapCommand(id, middlewareFn): Intercepts a command to add logic before/after execution.

Data Processing (Transforms)
api.send(channel, id, fn, priority): Adds a transformation step to a data pipeline.

api.receive(channel, initialData): Pipes data through all transformers in the channel.

🌟 Best Practices
Independent Files: Keep each feature in its own file (e.g., AuthFeature.ts, TableFeature.ts).

Use Derive: Prefer api.derive over manual updates to sync data between stores.

Scope Dependencies: Always pass the dependencyKey (3rd arg) in api.register to ensure optimal performance.

Avoid "Root" Spam: Create specific stores ("filters", "auth", "cart") instead of putting everything in "root". This prevents unnecessary re-renders.