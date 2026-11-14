import { LabLanguage } from "./workflow";

export interface LabExperiment {
  id: string;
  number: number;
  title: string;
  aim: string;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  frameworks: string[];
  runtime: LabLanguage;
  track: string;
  description: string;
  prerequisites?: string[];
  expectedOutputs: string[];
  starterPrompt: string;
}

export interface LabCategory {
  slug: string;
  track: string;
  title: string;
  shortTitle: string;
  tagline: string;
  description: string;
  defaultLanguage: LabLanguage;
  badge?: string;
  accentColor: string;
  features: string[];
  environmentSpecs: { label: string; value: string }[];
  experiments: LabExperiment[];
}

export const LAB_CATEGORIES: LabCategory[] = [
  {
    slug: "deep-learning",
    track: "deep_learning",
    title: "Deep Learning Labs",
    shortTitle: "Deep Learning",
    tagline: "Neural network architectures, model training & high-resolution notebook reports",
    description:
      "A dedicated, specialized environment for Deep Learning coursework. Run end-to-end PyTorch, TensorFlow 2.x and Keras experiments with CPU acceleration, automated dataset preparation, loss curve visualization, and publication-ready Colab/Jupyter reports.",
    defaultLanguage: "colab",
    badge: "Expanded Section",
    accentColor: "#8b5cf6",
    features: [
      "Full support for PyTorch 2.x, TensorFlow 2.15+ and Keras 3.x",
      "Automated convergence and metric plotting (Loss, Accuracy, Confusion Matrix)",
      "Strict framework validation — guarantees requested models are trained without silent fallback",
      "Dark & Light Colab high-resolution notebook captures",
      "Integrated dataset synthetic generators & standard benchmark loaders (MNIST, CIFAR-10, Iris)",
    ],
    environmentSpecs: [
      { label: "Engine", value: "Railway MicroVM Sandboxed Kernel" },
      { label: "Frameworks", value: "PyTorch 2.x, TensorFlow 2.x, Keras 3.x, Scikit-learn" },
      { label: "Plotting", value: "Matplotlib 3.8+, Seaborn" },
      { label: "Export Format", value: "Colab High-Res Capture + DOCX Report" },
    ],
    experiments: [
      {
        id: "dl-1",
        number: 1,
        title: "Single Layer Perceptron for Binary Classification",
        aim: "Design and implement a single layer perceptron from scratch and using Keras/PyTorch to classify linearly separable data (AND/OR logic gates).",
        category: "Foundations & Perceptrons",
        difficulty: "Beginner",
        frameworks: ["NumPy", "PyTorch / Keras", "Matplotlib"],
        runtime: "colab",
        track: "deep_learning",
        description:
          "Implement decision boundary learning for linearly separable logic gates using step activation functions and perceptron learning rule.",
        expectedOutputs: [
          "Weight convergence logs per epoch",
          "Final weights and bias parameters",
          "Linear decision boundary plot separating logic truth tables",
        ],
        starterPrompt:
          "Write and execute a complete Deep Learning experiment to implement a Single Layer Perceptron for binary classification of the AND and OR logic gates. Calculate weights, plot the decision boundary, and verify accuracy.",
      },
      {
        id: "dl-2",
        number: 2,
        title: "Multilayer Perceptron (MLP) for XOR Classification",
        aim: "Implement a Multilayer Perceptron with backpropagation to solve the non-linearly separable XOR problem using PyTorch or Keras.",
        category: "Foundations & Perceptrons",
        difficulty: "Beginner",
        frameworks: ["PyTorch / TensorFlow", "Matplotlib"],
        runtime: "colab",
        track: "deep_learning",
        description:
          "Demonstrate how hidden layers and non-linear activations (Sigmoid/ReLU) overcome the single-layer perceptron limitation on XOR data.",
        expectedOutputs: [
          "Loss reduction curve across 1000+ epochs",
          "Final model predictions matching XOR truth table",
          "Non-linear decision boundary contour visualization",
        ],
        starterPrompt:
          "Implement a Multilayer Perceptron using PyTorch or Keras to solve the XOR logic classification problem. Train the network, show epoch loss progression, and display the predicted probability outputs for all 4 inputs.",
      },
      {
        id: "dl-3",
        number: 3,
        title: "Mini-Batch Gradient Descent & Optimization Algorithms",
        aim: "Compare Batch, Mini-Batch, and Stochastic Gradient Descent (SGD) with Adam and RMSProp optimizers on a synthetic regression/classification dataset.",
        category: "Optimization & Training",
        difficulty: "Intermediate",
        frameworks: ["PyTorch / Keras", "NumPy", "Matplotlib"],
        runtime: "colab",
        track: "deep_learning",
        description:
          "Study how batch size and adaptive momentum optimizers affect training convergence speed, oscillation, and final generalization loss.",
        expectedOutputs: [
          "Comparative training loss curves (SGD vs Mini-Batch vs Adam)",
          "Convergence speed benchmark table",
          "Parameter trajectory visualization",
        ],
        starterPrompt:
          "Implement and compare Batch Gradient Descent, Mini-Batch Gradient Descent, and Adam optimizer on a non-trivial dataset. Plot training loss over epochs for each and analyze convergence behavior.",
      },
      {
        id: "dl-4",
        number: 4,
        title: "Deep Feedforward Neural Network for Multi-Class Classification",
        aim: "Build and train a Deep Feedforward Neural Network with multiple hidden layers, Dropout, and Batch Normalization for multi-class classification.",
        category: "Deep Feedforward Networks",
        difficulty: "Intermediate",
        frameworks: ["PyTorch / TensorFlow", "Scikit-Learn", "Matplotlib"],
        runtime: "colab",
        track: "deep_learning",
        description:
          "Design a multi-layer deep network using Softmax activation, Categorical Crossentropy loss, and Xavier/He weight initialization.",
        expectedOutputs: [
          "Model architecture summary table",
          "Training and Validation accuracy/loss curves",
          "Confusion matrix evaluation",
        ],
        starterPrompt:
          "Construct a deep neural network for multi-class classification with 3 hidden layers, Batch Normalization, and Dropout. Plot loss curves and output the test accuracy and classification report.",
      },
      {
        id: "dl-5",
        number: 5,
        title: "Convolutional Neural Network (CNN) for Image Classification",
        aim: "Design a Convolutional Neural Network with Conv2D, MaxPooling, and Dense layers for image classification on the MNIST/Fashion-MNIST dataset.",
        category: "Computer Vision",
        difficulty: "Intermediate",
        frameworks: ["TensorFlow/Keras", "PyTorch", "Matplotlib"],
        runtime: "colab",
        track: "deep_learning",
        description:
          "Construct feature extraction pipelines with spatial convolutions and pooling filters to classify 2D handwritten digits or clothing items.",
        expectedOutputs: [
          "Conv2D feature map dimensions & parameter summary",
          "Sample predictions grid with ground-truth vs predicted labels",
          "Test set accuracy exceeding 95%",
        ],
        starterPrompt:
          "Build and evaluate a Convolutional Neural Network (CNN) for MNIST handwritten digit recognition. Include Convolution, MaxPool, Flatten, and Dense layers. Train for 5 epochs and display sample predictions with accuracy.",
      },
      {
        id: "dl-6",
        number: 6,
        title: "Recurrent Neural Networks (RNN & LSTM) for Sequence Modeling",
        aim: "Implement SimpleRNN and Long Short-Term Memory (LSTM) networks for time-series forecasting or text sequence prediction.",
        category: "Sequence & Time-Series",
        difficulty: "Advanced",
        frameworks: ["PyTorch / Keras", "NumPy", "Matplotlib"],
        runtime: "colab",
        track: "deep_learning",
        description:
          "Address the vanishing gradient problem with gating mechanisms (LSTM/GRU) to model long-range temporal dependencies in sequence data.",
        expectedOutputs: [
          "Time-series prediction vs ground-truth comparison chart",
          "RMSE / MAE error evaluation",
          "Hidden state sequence dimensionality breakdown",
        ],
        starterPrompt:
          "Implement an LSTM recurrent neural network for time series prediction. Train the model, plot the actual versus predicted values, and compute Mean Squared Error.",
      },
      {
        id: "dl-7",
        number: 7,
        title: "Transfer Learning with Pretrained Vision Models",
        aim: "Fine-tune a pretrained deep network (MobileNetV2 or ResNet50) using feature extraction and fine-tuning for custom classification tasks.",
        category: "Transfer Learning",
        difficulty: "Advanced",
        frameworks: ["PyTorch / Keras Applications", "PIL", "Matplotlib"],
        runtime: "colab",
        track: "deep_learning",
        description:
          "Freeze base convolutional weights, add custom classification heads, and unfreeze top layers for fine-tuning with low learning rates.",
        expectedOutputs: [
          "Transfer learning feature extractor accuracy benchmark",
          "Fine-tuning epoch progression logs",
          "Prediction confidence scores on test images",
        ],
        starterPrompt:
          "Implement Transfer Learning using a pretrained MobileNetV2 model. Freeze base weights, train a custom classification head on a multi-class dataset, and report accuracy.",
      },
      {
        id: "dl-8",
        number: 8,
        title: "Autoencoder for Image Denoising & Dimensionality Reduction",
        aim: "Construct an encoder-decoder Autoencoder architecture to reconstruct compressed representations and remove Gaussian noise from inputs.",
        category: "Generative & Unsupervised",
        difficulty: "Advanced",
        frameworks: ["PyTorch / TensorFlow", "NumPy", "Matplotlib"],
        runtime: "colab",
        track: "deep_learning",
        description:
          "Implement bottleneck latent representations using MSE reconstruction loss to denoise corrupt input data.",
        expectedOutputs: [
          "Side-by-side comparison: Original, Noisy, and Reconstructed images",
          "Latent space dimensionality compression ratio",
          "Reconstruction loss reduction plot",
        ],
        starterPrompt:
          "Build an Autoencoder for image denoising. Add Gaussian noise to input images, train the encoder-decoder network, and display side-by-side original, noisy, and denoised outputs.",
      },
    ],
  },
  {
    slug: "distributed-computing",
    track: "distributed",
    title: "Distributed Computing Labs",
    shortTitle: "Distributed Computing",
    tagline: "Multi-process architectures, socket networks, Java RMI & consensus algorithms",
    description:
      "A specialized execution and reporting engine for Distributed Systems and Cloud Computing practicals. Compiles multi-file Java topologies, executes concurrent server and client processes in an isolated network sandbox, and captures simultaneous terminal outputs for your report.",
    defaultLanguage: "distributed",
    badge: "New Dedicated Section",
    accentColor: "#0ea5e9",
    features: [
      "Multi-file Java source compilation with topological dependency resolution",
      "Concurrent execution of Server, Client, and Registry processes in isolated microVM sandbox",
      "Loopback network orchestration with automated dynamic port injection",
      "Support for Java Socket API (TCP/UDP), Java RMI, Multithreading, and Distributed Consensus",
      "Multi-terminal screenshot generation showing Server and Client consoles side-by-side",
    ],
    environmentSpecs: [
      { label: "Java Version", value: "OpenJDK 17 / 21 LTS" },
      { label: "Networking", value: "Sandboxed Loopback TCP/UDP (127.0.0.1)" },
      { label: "Process Orchestration", value: "Multi-Process Concurrent Supervisor" },
      { label: "Screenshot Style", value: "Synchronized Multi-Window Terminal Capture" },
    ],
    experiments: [
      {
        id: "dc-1",
        number: 1,
        title: "Client-Server Socket Communication (TCP / UDP)",
        aim: "Implement a client-server socket communication program using Java TCP/UDP sockets for echo, two-way chat, or file exchange.",
        category: "Socket Programming",
        difficulty: "Beginner",
        frameworks: ["Java Socket API", "java.io", "java.net"],
        runtime: "distributed",
        track: "distributed",
        description:
          "Create a ServerSocket listening on a local port and a Client socket connecting to it. Exchange messages bidirectionally and gracefully close connections.",
        expectedOutputs: [
          "Server startup log: 'Server listening on port 5000...'",
          "Client connection handshake and message transmission",
          "Server response received and printed by client",
        ],
        starterPrompt:
          "Implement a Java TCP Client-Server program. The server listens on a socket and echoes back reverse capitalized strings sent by the client. Run both processes and demonstrate successful message exchange.",
      },
      {
        id: "dc-2",
        number: 2,
        title: "Remote Method Invocation (Java RMI) for Distributed Computing",
        aim: "Design and implement a distributed application using Java RMI where a remote client invokes computational methods on a remote server object.",
        category: "Remote Invocation",
        difficulty: "Intermediate",
        frameworks: ["java.rmi", "java.rmi.registry", "Java RMI Compiler"],
        runtime: "distributed",
        track: "distributed",
        description:
          "Define a Remote Interface, implement the Remote Object extending UnicastRemoteObject, bind it to the rmiregistry, and look it up from the client.",
        expectedOutputs: [
          "RMI Registry initialization on localhost",
          "Server object bound with service name in registry",
          "Client remote method call returning calculated result",
        ],
        starterPrompt:
          "Implement a distributed calculator application using Java RMI. Define the remote interface with add, subtract, and multiply methods. Implement the server, bind it to rmiregistry, and create a client that invokes each method.",
      },
      {
        id: "dc-3",
        number: 3,
        title: "Multi-Client Concurrent Chat Server using Multithreading",
        aim: "Implement a multithreaded TCP server that handles multiple simultaneous client connections using worker threads or thread pools.",
        category: "Concurrency & Sockets",
        difficulty: "Intermediate",
        frameworks: ["Java Threads", "java.net.ServerSocket", "ExecutorService"],
        runtime: "distributed",
        track: "distributed",
        description:
          "Spawn a dedicated ClientHandler thread for each incoming socket connection to broadcast messages to all active participants.",
        expectedOutputs: [
          "Server accepting connections from Client 1 and Client 2 simultaneously",
          "Broadcast message from Client 1 appearing on Client 2 terminal",
          "Graceful client disconnect handling without crashing server",
        ],
        starterPrompt:
          "Build a multi-threaded Java chat server capable of handling multiple concurrent clients. Spawn two client processes and verify that messages sent by one client are received by the other.",
      },
      {
        id: "dc-4",
        number: 4,
        title: "Distributed Mutual Exclusion Algorithm (Token Ring / Ricart-Agrawala)",
        aim: "Implement and simulate a distributed mutual exclusion algorithm to control access to a shared critical resource across distributed nodes.",
        category: "Distributed Algorithms",
        difficulty: "Advanced",
        frameworks: ["Java Sockets / Threads", "Distributed Simulation"],
        runtime: "distributed",
        track: "distributed",
        description:
          "Simulate a token-passing ring or timestamped request-reply protocol to guarantee safety, liveness, and freedom from starvation.",
        expectedOutputs: [
          "Token circulation between node processes",
          "Critical Section entry and exit logs with timestamp guarantees",
          "Mutual exclusion verification (no two nodes in critical section simultaneously)",
        ],
        starterPrompt:
          "Simulate the Token Ring algorithm for distributed mutual exclusion in Java. Create 4 node processes, circulate the token, and demonstrate how a node requests and enters the critical section exclusively.",
      },
      {
        id: "dc-5",
        number: 5,
        title: "Leader Election in Distributed Systems (Bully Algorithm)",
        aim: "Implement the Bully Election Algorithm to dynamically elect a new coordinator when the active leader fails in a distributed cluster.",
        category: "Consensus & Coordination",
        difficulty: "Advanced",
        frameworks: ["Java Networking", "Heartbeat & Election Protocol"],
        runtime: "distributed",
        track: "distributed",
        description:
          "Simulate node failure detection, ELECTION message broadcasting to higher-ID processes, OK responses, and COORDINATOR announcement messages.",
        expectedOutputs: [
          "Leader node crash simulation",
          "Election triggered by observing process",
          "Higher ID node winning election and broadcasting coordinator message to all alive nodes",
        ],
        starterPrompt:
          "Implement the Bully election algorithm in Java. Simulate 5 processes with IDs 1 to 5. Simulate the crash of leader process 5, trigger an election from process 2, and demonstrate process 4 taking over as new coordinator.",
      },
      {
        id: "dc-6",
        number: 6,
        title: "Lamport's Logical Clocks for Distributed Event Ordering",
        aim: "Implement Lamport's Logical Clock algorithm to order events across distributed processes in the absence of a synchronized physical clock.",
        category: "Time & Synchronization",
        difficulty: "Intermediate",
        frameworks: ["Java Sockets / Processes", "Logical Clock Vector"],
        runtime: "distributed",
        track: "distributed",
        description:
          "Update local process clock on internal events ($C_i = C_i + 1$) and on receiving message $m$ with timestamp $t$ ($C_i = \\max(C_i, t) + 1$).",
        expectedOutputs: [
          "Local event execution clock logs",
          "Message send timestamp logs",
          "Total ordering verified conforming to Lamport's 'happens-before' relation",
        ],
        starterPrompt:
          "Implement Lamport's Logical Clock algorithm in Java across 3 cooperating processes. Show clock updates for internal events, message transmissions, and message receipts to enforce causal ordering.",
      },
      {
        id: "dc-7",
        number: 7,
        title: "Distributed MapReduce Simulation for Word Count",
        aim: "Simulate a distributed MapReduce pipeline with Master, Mapper, and Reducer nodes for distributed text processing and aggregation.",
        category: "Distributed Data Processing",
        difficulty: "Advanced",
        frameworks: ["Java Concurrency", "MapReduce Paradigm"],
        runtime: "distributed",
        track: "distributed",
        description:
          "Partition input text across multiple Mapper worker processes, shuffle intermediate key-value pairs, and aggregate frequencies in Reducer workers.",
        expectedOutputs: [
          "Mapper input partition splits and key-value emission logs",
          "Shuffle and partition phase organizing intermediate keys",
          "Reducer final aggregated frequency table output",
        ],
        starterPrompt:
          "Create a Java distributed MapReduce simulation. Implement a Master coordinator, 2 Mapper tasks, and 1 Reducer task to perform word count on a sample distributed text corpus.",
      },
      {
        id: "dc-8",
        number: 8,
        title: "Distributed Shared Memory / Cache with Consistency Protocol",
        aim: "Implement a simulated Distributed Key-Value Store or Cache with read/write replication and consistency verification across nodes.",
        category: "Storage & Consistency",
        difficulty: "Advanced",
        frameworks: ["Java RMI / Sockets", "Replication Protocol"],
        runtime: "distributed",
        track: "distributed",
        description:
          "Implement primary-backup replication or quorum-based reads/writes across distributed storage instances with synchronization locks.",
        expectedOutputs: [
          "Cluster node synchronization on write operation",
          "Consistent read output across all replica nodes",
          "Conflict detection and resolution logs",
        ],
        starterPrompt:
          "Implement a distributed in-memory key-value store in Java with a master node and replica node. Demonstrate write propagation and read consistency.",
      },
    ],
  },
  {
    slug: "python",
    track: "python",
    title: "Basic Python Programming Labs",
    shortTitle: "Python",
    tagline: "Core syntax, data structures, algorithms, and OOP exercises",
    description:
      "Python programming practicals with IDLE or Jupyter style captures. Functions, recursion, file operations, classes, and standard library modules.",
    defaultLanguage: "python",
    accentColor: "#3b82f6",
    features: [
      "IDLE editor and IDLE shell captures",
      "Automated unit testing & stdin simulation",
      "Standard university practical syllabus coverage",
    ],
    environmentSpecs: [
      { label: "Python Version", value: "Python 3.10+" },
      { label: "Capture Styles", value: "IDLE Windows Editor / Shell, Jupyter" },
    ],
    experiments: [
      {
        id: "py-1",
        number: 1,
        title: "Basic Control Flow, Functions & Recursion",
        aim: "Write Python programs to demonstrate conditionals, loops, functions, and recursive problem solving (Fibonacci, Factorial, GCD).",
        category: "Basics",
        difficulty: "Beginner",
        frameworks: ["Python standard library"],
        runtime: "python",
        track: "python",
        description: "Core algorithms and recursion with clean functional structure.",
        expectedOutputs: ["Accurate mathematical calculations", "Formatted terminal outputs"],
        starterPrompt: "Write Python programs for factorial calculation, Fibonacci series up to n terms, and GCD of two numbers.",
      },
    ],
  },
  {
    slug: "java",
    track: "java",
    title: "Java Programming Labs",
    shortTitle: "Java",
    tagline: "Object-oriented programming, inheritance, interfaces & multithreading",
    description:
      "Classic Java coursework formatted with Windows Notepad source code and Windows Command Prompt execution captures.",
    defaultLanguage: "java",
    accentColor: "#f97316",
    features: [
      "JDK 17/21 compilation and execution",
      "Windows Notepad + Command Prompt captures",
      "Exception handling and multithreading practicals",
    ],
    environmentSpecs: [
      { label: "JDK Version", value: "OpenJDK 17 LTS" },
      { label: "Capture Style", value: "Windows Notepad & Command Prompt" },
    ],
    experiments: [
      {
        id: "java-1",
        number: 1,
        title: "OOP Concepts: Classes, Inheritance & Polymorphism",
        aim: "Demonstrate class hierarchy, method overriding, super keyword, and polymorphic dispatch in Java.",
        category: "OOP",
        difficulty: "Beginner",
        frameworks: ["Java SE"],
        runtime: "java",
        track: "java",
        description: "Class hierarchies, constructor chaining, and method overriding.",
        expectedOutputs: ["Clean javac compilation", "Expected polymorphic method outputs"],
        starterPrompt: "Write a Java program demonstrating hierarchical inheritance and method overriding for a Shape hierarchy.",
      },
    ],
  },
  {
    slug: "c-cpp",
    track: "cpp",
    title: "C & C++ Programming Labs",
    shortTitle: "C / C++",
    tagline: "Pointers, memory management, data structures & STL",
    description:
      "Procedural C and object-oriented C++ coursework rendered with Code::Blocks IDE styling and Command Prompt terminal output.",
    defaultLanguage: "cpp",
    accentColor: "#6366f1",
    features: [
      "GCC/G++ 13+ native compilation",
      "Code::Blocks IDE source capture style",
      "Data structures: linked lists, stacks, queues, trees",
    ],
    environmentSpecs: [
      { label: "Compiler", value: "GCC / G++ 13.x" },
      { label: "Capture Style", value: "Code::Blocks IDE & Windows Terminal" },
    ],
    experiments: [
      {
        id: "cpp-1",
        number: 1,
        title: "Dynamic Memory & Data Structures (Linked List / Binary Tree)",
        aim: "Implement linked lists, stacks, and binary search tree traversals using pointers and dynamic memory allocation.",
        category: "Data Structures",
        difficulty: "Intermediate",
        frameworks: ["C / C++ STL"],
        runtime: "cpp",
        track: "cpp",
        description: "Pointers, memory allocation, and traversal algorithms.",
        expectedOutputs: ["Successful compilation without warnings", "Correct traversal sequences"],
        starterPrompt: "Implement a singly linked list in C++ with insert, delete, and display operations.",
      },
    ],
  },
  {
    slug: "web-development",
    track: "web",
    title: "Web Development Labs",
    shortTitle: "Web Dev",
    tagline: "HTML5, CSS3, modern JavaScript, React components & Node.js backends",
    description:
      "Full-stack and frontend web coursework. Captures VS Code source views side-by-side with real headless browser page renders in Microsoft Edge frame.",
    defaultLanguage: "html",
    accentColor: "#10b981",
    features: [
      "Full browser rendering via Playwright Chromium/Edge engine",
      "VS Code Dark Modern editor presentation",
      "Multi-file HTML, CSS, JavaScript, and React project execution",
    ],
    environmentSpecs: [
      { label: "Rendering Engine", value: "Playwright Headless Browser (Edge/Chrome)" },
      { label: "Frontend Stacks", value: "HTML5/CSS3/Vanilla JS, React + Vite, Node.js" },
    ],
    experiments: [
      {
        id: "web-1",
        number: 1,
        title: "Responsive Web Layout with CSS Grid & Flexbox",
        aim: "Create a modern, responsive landing page using semantic HTML5 and modern CSS Flexbox/Grid techniques.",
        category: "Frontend",
        difficulty: "Beginner",
        frameworks: ["HTML5", "CSS3", "JavaScript"],
        runtime: "html",
        track: "web",
        description: "Clean responsive layout with navigation, cards, and interactive forms.",
        expectedOutputs: ["Pixel-perfect browser viewport screenshot", "Responsive formatting across screen widths"],
        starterPrompt: "Create a responsive student portfolio website using semantic HTML5, CSS Grid for project cards, and CSS Flexbox for the navbar.",
      },
    ],
  },
  {
    slug: "sql",
    track: "sql",
    title: "SQL & Database Labs",
    shortTitle: "SQL",
    tagline: "DDL, DML, relational schemas, complex joins & aggregate queries",
    description:
      "Database management practicals executed against real MySQL instances. Captures query execution along with tabular result grids in MySQL Workbench style.",
    defaultLanguage: "sql",
    accentColor: "#ec4899",
    features: [
      "Real MySQL 8.x database container execution",
      "MySQL Workbench capture style with query and tabular results",
      "Schema creation, table constraints, triggers, and nested subqueries",
    ],
    environmentSpecs: [
      { label: "Database Engine", value: "MySQL 8.x Sandboxed Instance" },
      { label: "Capture Style", value: "MySQL Workbench SQL Editor + Results Grid" },
    ],
    experiments: [
      {
        id: "sql-1",
        number: 1,
        title: "Relational Schema Creation, Constraints & Complex Queries",
        aim: "Design an employee-department schema, enforce primary/foreign keys, and execute complex GROUP BY, HAVING, and JOIN queries.",
        category: "Queries & Schema",
        difficulty: "Intermediate",
        frameworks: ["MySQL 8.x"],
        runtime: "sql",
        track: "sql",
        description: "DDL, relational constraints, foreign keys, and analytical queries.",
        expectedOutputs: ["DDL table creation status", "Tabular formatted SQL result set grid"],
        starterPrompt: "Create Employee and Department tables with foreign key constraints, insert sample data, and write queries for joins and department-wise average salary.",
      },
    ],
  },
  {
    slug: "colab",
    track: "colab",
    title: "Google Colab & Notebook Labs",
    shortTitle: "Notebooks",
    tagline: "Data science, exploratory analysis, visualization & machine learning notebooks",
    description:
      "Jupyter and Google Colab notebook workflows. Executes multi-cell code blocks, renders interactive matplotlib/seaborn plots, and formats high-res notebook captures.",
    defaultLanguage: "colab",
    accentColor: "#f59e0b",
    features: [
      "Jupyter / Colab multi-cell execution runtime",
      "Matplotlib, Seaborn, Pandas, and NumPy integration",
      "Light and Dark notebook capture themes",
    ],
    environmentSpecs: [
      { label: "Runtime", value: "Jupyter Kernel MicroVM" },
      { label: "Libraries", value: "Pandas, NumPy, Matplotlib, Scipy, Scikit-learn" },
    ],
    experiments: [
      {
        id: "colab-1",
        number: 1,
        title: "Data Exploration, Cleaning & Statistical Visualization",
        aim: "Load tabular data, perform missing value imputation, calculate summary statistics, and generate correlation heatmaps.",
        category: "Data Science",
        difficulty: "Beginner",
        frameworks: ["Pandas", "Matplotlib", "Seaborn"],
        runtime: "colab",
        track: "colab",
        description: "EDA pipelines with summary statistics and distribution plots.",
        expectedOutputs: ["DataFrame summary heads", "Correlation heatmap figure in notebook cell"],
        starterPrompt: "Write a complete Colab notebook to load a dataset, clean missing values, compute descriptive statistics, and plot a correlation heatmap.",
      },
    ],
  },
  {
    slug: "r",
    track: "r",
    title: "R & RStudio Labs",
    shortTitle: "R / RStudio",
    tagline: "Statistics, data frames, plots and models run in real R and captured in an RStudio workspace",
    description:
      "R practicals executed by a real Rscript. The script appears in the RStudio source editor, its transcript in the console, variables in the Environment pane and figures in the Plots pane.",
    defaultLanguage: "r",
    badge: "New",
    accentColor: "#2a6fbb",
    features: [
      "Real Rscript execution with expression-by-expression console echo",
      "RStudio source, console, Environment and Plots panes in light or dark theme",
      "Base R plus ggplot2, dplyr, tidyr, MASS, e1071, randomForest and rpart",
      "Built-in datasets only; no network access during a run",
    ],
    environmentSpecs: [
      { label: "Runtime", value: "R (Rscript)" },
      { label: "Packages", value: "Base R, ggplot2, dplyr, tidyr, MASS, rpart, e1071, randomForest" },
      { label: "Plot Device", value: "PNG (cairo) captured into the Plots pane" },
      { label: "Screenshot Style", value: "RStudio (source, console, Environment, Plots)" },
    ],
    experiments: [
      {
        id: "r-1",
        number: 1,
        title: "Vectors, Operators & Built-in Functions",
        aim: "Create numeric, character and logical vectors and apply arithmetic, comparison and summary functions.",
        category: "R Basics",
        difficulty: "Beginner",
        frameworks: ["R", "base"],
        runtime: "r",
        track: "r",
        description:
          "Vectors built, indexed and summarised, with the result of each operation printed in the console.",
        expectedOutputs: [
          "Console output of vector arithmetic and summary functions",
          "Variables listed in the Environment pane",
        ],
        starterPrompt:
          "Write an R script that creates numeric, character and logical vectors, performs vectorised arithmetic and comparisons, subsets with an index and a condition, and prints length(), sum(), mean(), min(), max() and seq()/rep() results.",
      },
      {
        id: "r-2",
        number: 2,
        title: "Descriptive Statistics on the mtcars Dataset",
        aim: "Compute measures of central tendency and spread and summarise a built-in dataset.",
        category: "Statistics",
        difficulty: "Beginner",
        frameworks: ["R", "stats"],
        runtime: "r",
        track: "r",
        description:
          "Mean, median, variance, standard deviation, quantiles and summary() of mtcars columns.",
        expectedOutputs: [
          "summary() table and str() of the data frame",
          "Mean, median, sd and quantiles for mpg",
        ],
        starterPrompt:
          "Write an R script that loads the built-in mtcars dataset, prints str() and summary(), and computes the mean, median, variance, standard deviation, range and quartiles of mpg, plus the mode of cyl.",
      },
      {
        id: "r-3",
        number: 3,
        title: "Data Frames: Subsetting, Sorting & Aggregation",
        aim: "Build and manipulate data frames with indexing, order(), merge() and aggregate().",
        category: "Data Manipulation",
        difficulty: "Intermediate",
        frameworks: ["R", "base"],
        runtime: "r",
        track: "r",
        description:
          "A student data frame filtered, sorted, extended with a derived column and aggregated by group.",
        expectedOutputs: [
          "Filtered and sorted data frame printed",
          "aggregate() result by group",
          "Data frame visible in the Environment pane",
        ],
        starterPrompt:
          "Write an R script that builds a data frame of students (name, branch, marks), filters rows with a condition, sorts with order(), adds a grade column with ifelse(), merges it with a second data frame and aggregates the mean marks by branch.",
      },
      {
        id: "r-4",
        number: 4,
        title: "Base Graphics: Histogram, Box Plot & Scatter Plot",
        aim: "Visualise a distribution and a relationship with base R graphics.",
        category: "Visualization",
        difficulty: "Beginner",
        frameworks: ["R", "graphics"],
        runtime: "r",
        track: "r",
        description:
          "Histogram, box plot and scatter plot with a fitted line drawn in the RStudio Plots pane.",
        expectedOutputs: [
          "Plots pane showing the figure",
          "Console output of the correlation coefficient",
        ],
        starterPrompt:
          "Write an R script that uses the built-in mtcars dataset to draw a histogram of mpg, a box plot of mpg by cyl and a scatter plot of wt against mpg with abline(lm()), arranged with par(mfrow), and prints cor(wt, mpg).",
      },
      {
        id: "r-5",
        number: 5,
        title: "Simple & Multiple Linear Regression",
        aim: "Fit, interpret and use linear models with lm().",
        category: "Regression",
        difficulty: "Intermediate",
        frameworks: ["R", "stats"],
        runtime: "r",
        track: "r",
        description:
          "A regression of mpg on weight and horsepower with coefficients, R-squared and predictions.",
        expectedOutputs: [
          "summary(lm) output with coefficients and R-squared",
          "Predicted values for new data",
          "Fitted-line plot",
        ],
        starterPrompt:
          "Write an R script that fits lm(mpg ~ wt) and lm(mpg ~ wt + hp) on mtcars, prints summary() and anova(), predicts mpg for new cars with predict(), and plots the fitted line over the data.",
      },
      {
        id: "r-6",
        number: 6,
        title: "Hypothesis Testing: t-test & Chi-square",
        aim: "Run parametric and categorical tests and read the p-value.",
        category: "Statistics",
        difficulty: "Intermediate",
        frameworks: ["R", "stats"],
        runtime: "r",
        track: "r",
        description:
          "One-sample, two-sample and paired t-tests and a chi-square test of independence with conclusions.",
        expectedOutputs: [
          "t.test() and chisq.test() output",
          "A printed decision at the 5% level",
        ],
        starterPrompt:
          "Write an R script that runs a one-sample t.test on mtcars mpg, a two-sample t.test of mpg by transmission (am), a paired t.test on the built-in sleep data and a chisq.test on table(mtcars$cyl, mtcars$am), and prints a decision for each at alpha = 0.05.",
      },
      {
        id: "r-7",
        number: 7,
        title: "ggplot2: Grammar of Graphics & Facets",
        aim: "Build layered, faceted plots with ggplot2.",
        category: "Visualization",
        difficulty: "Intermediate",
        frameworks: ["R", "ggplot2"],
        runtime: "r",
        track: "r",
        description:
          "A scatter plot coloured by group with a smoother, and a faceted bar chart, in the Plots pane.",
        expectedOutputs: [
          "ggplot scatter with regression smoother in the Plots pane",
          "Faceted bar chart",
        ],
        starterPrompt:
          "Write an R script that loads ggplot2 and draws, from the built-in mtcars data, a scatter plot of wt against mpg coloured by factor(cyl) with geom_smooth(method = 'lm'), then a bar chart of car counts by cyl faceted by transmission, with titles and theme_minimal().",
      },
      {
        id: "r-8",
        number: 8,
        title: "Clustering & Classification: k-means and Decision Tree",
        aim: "Group observations with k-means and classify with a decision tree.",
        category: "Machine Learning",
        difficulty: "Advanced",
        frameworks: ["R", "stats", "rpart"],
        runtime: "r",
        track: "r",
        description:
          "k-means on iris measurements compared with the species labels, and an rpart tree with its accuracy.",
        expectedOutputs: [
          "Cluster sizes and a confusion table",
          "Decision tree accuracy on a held-out set",
          "Cluster plot in the Plots pane",
        ],
        starterPrompt:
          "Write an R script that runs set.seed(42), clusters the iris measurements with kmeans(centers = 3), compares clusters with Species using table(), plots the clusters, then trains an rpart decision tree on a 70/30 split of iris and prints the confusion matrix and accuracy.",
      },
    ],
  },
];

export function getLabCategory(slugOrTrack: string): LabCategory | undefined {
  const normalized = slugOrTrack.toLowerCase().replace(/_/g, "-");
  return LAB_CATEGORIES.find(
    (c) =>
      c.slug.toLowerCase() === normalized ||
      c.track.toLowerCase().replace(/_/g, "-") === normalized,
  );
}

export function getAllLabCategories(): LabCategory[] {
  return LAB_CATEGORIES;
}

export function getExperimentsByTrack(track: string): LabExperiment[] {
  const category = getLabCategory(track);
  return category ? category.experiments : [];
}

