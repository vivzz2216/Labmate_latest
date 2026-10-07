"""Executable sample programs and stdin for the C/C++ laboratory reports.

Only real compiler/runtime stdout is eligible for an execution screenshot.
These overrides replace incomplete examples in the legacy manual data.
"""

SAMPLE_STDIN = {
    "array_pointers.c": "6\n12 45 78 23 56 89\n23\n",
    "string_custom.c": "Computer\nScience\n",
    "dynamic_stats.c": "5\n10.5 12.0 15.5 18.0 24.0\n",
    "student_structures.c": "3\n101 Rahul 88 92 85\n102 Priya 95 90 98\n103 Amit 74 68 80\n",
    "file_word_counter.c": "",
    "binary_employee.c": "502\n",
    "stack_menu.cpp": "1\n10\n1\n20\n1\n30\n4\n3\n2\n4\n5\n",
    "circular_queue.cpp": "1\n100\n1\n200\n1\n300\n1\n400\n4\n2\n1\n500\n4\n5\n",
    "infix_postfix.cpp": "(2+3)*(7-4)+8/2\n",
    "bst_traversals.cpp": "7\n50 30 70 20 40 60 80\n",
    "bst_menu_deletion.cpp": "2\n60\n3\n20\n3\n30\n3\n50\n4\n5\n",
    "tree_metrics_mirror.cpp": "50 30 70 20 40 60 80 -1\n",
    "graph_traversals.cpp": "5\n6\n0 1\n0 4\n1 2\n1 3\n1 4\n2 3\n0\n",
    "dijkstra_shortest_path.cpp": "5\n7\n0 1 4\n0 2 1\n2 1 2\n1 3 1\n2 3 5\n3 4 3\n1 4 6\n0\n",
    "prims_mst.cpp": "5\n7\n0 1 2\n0 3 6\n1 2 3\n1 3 8\n1 4 5\n2 4 7\n3 4 9\n",
}


FULL_PROGRAMS = {
    "file_word_counter.c": r'''#include <stdio.h>
#include <ctype.h>

int main(void) {
    const char *sample = "C programming lab.\nCount every word and line.\n123 students learn file IO.\n";
    FILE *file = fopen("sample_text.txt", "w");
    if (!file) { perror("sample_text.txt"); return 1; }
    fputs(sample, file);
    fclose(file);

    file = fopen("sample_text.txt", "r");
    if (!file) { perror("sample_text.txt"); return 1; }
    int ch, previous = '\n', characters = 0, letters = 0;
    int digits = 0, whitespace = 0, lines = 0, words = 0, in_word = 0;
    while ((ch = fgetc(file)) != EOF) {
        characters++;
        if (isalpha((unsigned char)ch)) letters++;
        if (isdigit((unsigned char)ch)) digits++;
        if (isspace((unsigned char)ch)) whitespace++;
        if (ch == '\n') lines++;
        if (isspace((unsigned char)ch)) in_word = 0;
        else if (!in_word) { words++; in_word = 1; }
        previous = ch;
    }
    if (characters && previous != '\n') lines++;
    fclose(file);

    FILE *report = fopen("file_summary_report.txt", "w");
    if (!report) { perror("file_summary_report.txt"); return 1; }
    fprintf(report, "Characters: %d\nLetters: %d\nDigits: %d\nWhitespace: %d\nLines: %d\nWords: %d\n",
            characters, letters, digits, whitespace, lines, words);
    fclose(report);
    printf("=== C LAB: FILE WORD AND CHARACTER COUNTER ===\n");
    printf("Sample input file created: sample_text.txt\n");
    printf("Total Characters: %d\nAlphabetic Characters: %d\nNumeric Digits: %d\n", characters, letters, digits);
    printf("Whitespace Characters: %d\nTotal Lines: %d\nTotal Words: %d\n", whitespace, lines, words);
    printf("Report written to file_summary_report.txt\n");
    return 0;
}''',
    "binary_employee.c": r'''#include <stdio.h>

struct Employee { int id; char name[40]; double salary; };

int main(void) {
    struct Employee employees[] = {
        {501, "Dennis Ritchie", 85000.0},
        {502, "Ken Thompson", 92000.0},
        {503, "Bjarne Stroustrup", 96000.0}
    };
    FILE *file = fopen("employees.dat", "wb");
    if (!file) { perror("employees.dat"); return 1; }
    size_t written = fwrite(employees, sizeof employees[0], 3, file);
    fclose(file);
    if (written != 3) { fputs("Binary write failed.\n", stderr); return 1; }

    int target;
    printf("=== C LAB: BINARY FILE OPERATIONS (fwrite / fread) ===\n");
    printf("Wrote %zu employee records to employees.dat\n", written);
    printf("Enter employee ID to search: ");
    if (scanf("%d", &target) != 1) return 1;
    file = fopen("employees.dat", "rb");
    if (!file) { perror("employees.dat"); return 1; }
    struct Employee current;
    int found = 0;
    while (fread(&current, sizeof current, 1, file) == 1) {
        if (current.id == target) {
            printf("Record Found: ID=%d, Name=%s, Salary=$%.2f\n",
                   current.id, current.name, current.salary);
            found = 1;
            break;
        }
    }
    fclose(file);
    if (!found) printf("Employee ID %d not found.\n", target);
    return 0;
}''',
    "circular_queue.cpp": r'''#include <iostream>
#include <vector>
using namespace std;

class CircularQueue {
    vector<int> items;
    int front = 0, count = 0;
public:
    explicit CircularQueue(int capacity) : items(capacity) {}
    bool empty() const { return count == 0; }
    bool full() const { return count == static_cast<int>(items.size()); }
    bool enqueue(int value) {
        if (full()) return false;
        items[(front + count) % items.size()] = value;
        ++count;
        return true;
    }
    bool dequeue(int& value) {
        if (empty()) return false;
        value = items[front];
        front = (front + 1) % items.size();
        --count;
        return true;
    }
    int first() const { return items[front]; }
    void display() const {
        cout << "Circular Queue elements: [ ";
        for (int i = 0; i < count; ++i)
            cout << items[(front + i) % items.size()] << (i + 1 == count ? " " : ", ");
        cout << "] (Front=" << front << ", Rear="
             << (count ? (front + count - 1) % items.size() : -1) << ")\n";
    }
};

int main() {
    CircularQueue queue(4);
    int choice, value;
    cout << "=== C++ DSA LAB: CIRCULAR QUEUE IMPLEMENTATION ===\n";
    cout << "Circular Queue created with capacity = 4\n";
    while (true) {
        cout << "1.Enqueue 2.Dequeue 3.Front 4.Display 5.Exit\nChoice: ";
        if (!(cin >> choice)) return 1;
        switch (choice) {
            case 1:
                cout << "Element: ";
                if (!(cin >> value)) return 1;
                cout << (queue.enqueue(value) ? "Enqueued: " : "Queue Overflow: ") << value << '\n';
                break;
            case 2:
                if (queue.dequeue(value)) cout << "Dequeued element: " << value << '\n';
                else cout << "Queue Underflow! Queue is empty.\n";
                break;
            case 3:
                if (queue.empty()) cout << "Queue is empty.\n";
                else cout << "Front element: " << queue.first() << '\n';
                break;
            case 4: queue.display(); break;
            case 5: cout << "Exiting Circular Queue.\n"; return 0;
            default: cout << "Invalid choice.\n";
        }
    }
}''',
    "infix_postfix.cpp": r'''#include <iostream>
#include <stack>
#include <string>
#include <vector>
#include <cctype>
#include <stdexcept>
using namespace std;

int precedence(char op) {
    if (op == '+' || op == '-') return 1;
    if (op == '*' || op == '/') return 2;
    if (op == '^') return 3;
    return 0;
}

int main() {
    string infix, token;
    vector<string> postfix;
    stack<char> operators;
    cout << "=== C++ DSA LAB: INFIX TO POSTFIX CONVERTER & EVALUATOR ===\n";
    cout << "Enter Infix Arithmetic Expression: ";
    if (!getline(cin, infix)) return 1;
    try {
        for (size_t i = 0; i < infix.size();) {
            char ch = infix[i];
            if (isspace(static_cast<unsigned char>(ch))) { ++i; continue; }
            if (isdigit(static_cast<unsigned char>(ch))) {
                token.clear();
                while (i < infix.size() && isdigit(static_cast<unsigned char>(infix[i])))
                    token += infix[i++];
                postfix.push_back(token);
                continue;
            }
            if (ch == '(') operators.push(ch);
            else if (ch == ')') {
                while (!operators.empty() && operators.top() != '(') {
                    postfix.push_back(string(1, operators.top())); operators.pop();
                }
                if (operators.empty()) throw runtime_error("Unmatched closing parenthesis");
                operators.pop();
            } else if (precedence(ch)) {
                while (!operators.empty() && operators.top() != '(' &&
                       (precedence(operators.top()) > precedence(ch) ||
                        (precedence(operators.top()) == precedence(ch) && ch != '^'))) {
                    postfix.push_back(string(1, operators.top())); operators.pop();
                }
                operators.push(ch);
            } else throw runtime_error("Unsupported token");
            ++i;
        }
        while (!operators.empty()) {
            if (operators.top() == '(') throw runtime_error("Unmatched opening parenthesis");
            postfix.push_back(string(1, operators.top())); operators.pop();
        }
        cout << "Final Postfix Expression: ";
        for (const auto& item : postfix) cout << item << ' ';
        cout << '\n';
        stack<long long> values;
        for (const auto& item : postfix) {
            if (isdigit(static_cast<unsigned char>(item[0]))) {
                values.push(stoll(item)); continue;
            }
            if (values.size() < 2) throw runtime_error("Missing operand");
            long long right = values.top(); values.pop();
            long long left = values.top(); values.pop();
            if (item == "+") values.push(left + right);
            else if (item == "-") values.push(left - right);
            else if (item == "*") values.push(left * right);
            else if (item == "/") {
                if (right == 0) throw runtime_error("Division by zero");
                values.push(left / right);
            } else {
                if (right < 0 || right > 32) throw runtime_error("Unsupported exponent");
                long long power = 1;
                while (right--) power *= left;
                values.push(power);
            }
        }
        if (values.size() != 1) throw runtime_error("Invalid expression");
        cout << "Computed Evaluation Result: " << values.top() << '\n';
    } catch (const exception& error) {
        cerr << "Expression error: " << error.what() << '\n';
        return 1;
    }
    return 0;
}''',
    "prims_mst.cpp": r'''#include <iostream>
#include <vector>
#include <climits>
#include <algorithm>
using namespace std;

int main() {
    int vertices, edges, u, v, weight;
    cout << "=== C++ DSA LAB: PRIM'S MINIMUM SPANNING TREE (MST) ===\n";
    cout << "Enter number of vertices (V): ";
    if (!(cin >> vertices) || vertices < 1 || vertices > 100) return 1;
    cout << "Enter number of weighted edges (E): ";
    if (!(cin >> edges) || edges < 0) return 1;
    vector<vector<int>> graph(vertices, vector<int>(vertices, INT_MAX));
    cout << "Enter edges (u v weight):\n";
    for (int i = 0; i < edges; ++i) {
        if (!(cin >> u >> v >> weight) || u < 0 || v < 0 ||
            u >= vertices || v >= vertices || weight < 0) return 1;
        graph[u][v] = graph[v][u] = min(graph[u][v], weight);
    }
    vector<int> best(vertices, INT_MAX), parent(vertices, -1);
    vector<bool> selected(vertices, false);
    best[0] = 0;
    int total = 0;
    cout << "--- PRIM'S MST COMPUTATION ---\nStarting vertex: 0\n";
    for (int step = 0; step < vertices; ++step) {
        int next = -1;
        for (int i = 0; i < vertices; ++i)
            if (!selected[i] && (next < 0 || best[i] < best[next])) next = i;
        if (next < 0 || best[next] == INT_MAX) {
            cerr << "Graph is disconnected; no spanning tree exists.\n";
            return 1;
        }
        selected[next] = true;
        if (parent[next] >= 0) {
            cout << "Selected Edge: " << parent[next] << " - " << next
                 << " (Weight: " << best[next] << ")\n";
            total += best[next];
        }
        for (int neighbor = 0; neighbor < vertices; ++neighbor)
            if (!selected[neighbor] && graph[next][neighbor] < best[neighbor]) {
                best[neighbor] = graph[next][neighbor]; parent[neighbor] = next;
            }
    }
    cout << "Total Minimum Weight of Spanning Tree = " << total << '\n';
    return 0;
}''',
}


MAIN_OVERRIDES = {
    "student_structures.c": r'''int main(void) {
    struct Student students[30];
    int n;
    printf("=== C LAB: STUDENT RECORD MANAGEMENT (STRUCTURES) ===\n");
    printf("Enter number of students (1-30): ");
    if (scanf("%d", &n) != 1 || n < 1 || n > 30) return 1;
    for (int i = 0; i < n; i++) {
        printf("Enter roll, first name, and three marks for student %d: ", i + 1);
        if (scanf("%d %49s %f %f %f", &students[i].roll_no, students[i].name,
                  &students[i].marks[0], &students[i].marks[1], &students[i].marks[2]) != 5) return 1;
        calculate_grade(&students[i]);
    }
    for (int i = 0; i < n - 1; i++)
        for (int j = 0; j < n - i - 1; j++)
            if (students[j].percentage < students[j + 1].percentage) {
                struct Student temp = students[j];
                students[j] = students[j + 1];
                students[j + 1] = temp;
            }
    printf("\nRANK | ROLL | NAME | TOTAL | PERCENTAGE | GRADE\n");
    for (int i = 0; i < n; i++)
        printf("%d | %d | %s | %.2f | %.2f%% | %s\n", i + 1, students[i].roll_no,
               students[i].name, students[i].total, students[i].percentage, students[i].grade);
    return 0;
}''',
    "stack_menu.cpp": r'''int main() {
    Stack stack;
    int choice, value;
    cout << "=== C++ DSA LAB: MENU-DRIVEN STACK IMPLEMENTATION ===" << endl;
    while (true) {
        cout << "1.Push 2.Pop 3.Peek 4.Display 5.Exit\nChoice: ";
        if (!(cin >> choice)) return 1;
        switch (choice) {
            case 1:
                cout << "Value: ";
                if (!(cin >> value)) return 1;
                stack.push(value);
                break;
            case 2:
                if (!stack.isEmpty()) cout << "Popped element: " << stack.pop() << endl;
                else stack.pop();
                break;
            case 3:
                if (!stack.isEmpty()) cout << "Top Element: " << stack.peek() << endl;
                else stack.peek();
                break;
            case 4: stack.display(); break;
            case 5: cout << "Exiting Stack program." << endl; return 0;
            default: cout << "Invalid choice." << endl;
        }
    }
}''',
    "bst_traversals.cpp": r'''int main() {
    int n, key;
    cout << "=== C++ DSA LAB: BINARY SEARCH TREE CONSTRUCT & TRAVERSALS ===" << endl;
    cout << "Number of keys: ";
    if (!(cin >> n) || n < 1 || n > 100) return 1;
    Node *root = nullptr;
    cout << "Enter " << n << " keys: ";
    for (int i = 0; i < n; i++) {
        if (!(cin >> key)) return 1;
        root = insert(root, key);
    }
    cout << "Inorder: "; inorder(root); cout << endl;
    cout << "Preorder: "; preorder(root); cout << endl;
    cout << "Postorder: "; postorder(root); cout << endl;
    cout << "Level-order: "; levelOrder(root); cout << endl;
    return 0;
}''',
    "bst_menu_deletion.cpp": r'''Node* insert(Node* root, int key) {
    if (!root) return new Node(key);
    if (key < root->data) root->left = insert(root->left, key);
    else if (key > root->data) root->right = insert(root->right, key);
    return root;
}

void inorder(Node* root) {
    if (!root) return;
    inorder(root->left);
    cout << root->data << ' ';
    inorder(root->right);
}

int searchLevel(Node* root, int key) {
    int level = 0;
    while (root) {
        if (root->data == key) return level;
        root = key < root->data ? root->left : root->right;
        ++level;
    }
    return -1;
}

int main() {
    Node* root = nullptr;
    for (int key : {50, 30, 70, 20, 40, 60, 80}) root = insert(root, key);
    int choice, key;
    cout << "=== C++ DSA LAB: BST SEARCH & DELETION WITH USER INPUT ===\n";
    cout << "Initial keys: 50 30 70 20 40 60 80\n";
    while (true) {
        cout << "1.Insert 2.Search 3.Delete 4.Inorder 5.Exit\nChoice: ";
        if (!(cin >> choice)) return 1;
        if (choice == 5) { cout << "Exiting BST program.\n"; return 0; }
        if (choice == 4) { cout << "Current Inorder Traversal: "; inorder(root); cout << '\n'; continue; }
        if (choice < 1 || choice > 3) { cout << "Invalid choice.\n"; continue; }
        cout << "Key: ";
        if (!(cin >> key)) return 1;
        int level = searchLevel(root, key);
        if (choice == 1) {
            root = insert(root, key);
            cout << (level < 0 ? "Inserted: " : "Already present: ") << key << '\n';
        } else if (choice == 2) {
            cout << (level < 0 ? "Key not found." : "Key found at level " + to_string(level)) << '\n';
        } else if (level < 0) cout << "Key not found.\n";
        else { root = deleteNode(root, key); cout << "Deleted: " << key << '\n'; }
    }
}''',
    "tree_metrics_mirror.cpp": r'''Node* insert(Node* root, int key) {
    if (!root) return new Node(key);
    if (key < root->data) root->left = insert(root->left, key);
    else if (key > root->data) root->right = insert(root->right, key);
    return root;
}

int main() {
    Node* root = nullptr;
    int key;
    cout << "=== C++ DSA LAB: TREE METRICS & MIRROR TRANSFORMATION ===\n";
    cout << "Enter keys for binary search tree (terminated by -1): ";
    while (cin >> key && key != -1) root = insert(root, key);
    if (!root) return 1;
    cout << "Total Nodes in Tree = " << countNodes(root) << '\n';
    cout << "Total Leaf Nodes = " << countLeaves(root) << '\n';
    cout << "Total Internal Nodes = " << countNodes(root) - countLeaves(root) << '\n';
    cout << "Maximum Tree Height = " << treeHeight(root) << '\n';
    cout << "Original Tree Inorder: "; inorder(root); cout << '\n';
    mirrorTree(root);
    cout << "Mirror Tree Inorder: "; inorder(root); cout << '\n';
    return 0;
}''',
    "graph_traversals.cpp": r'''int main() {
    int vertices, edges, source, u, v;
    cout << "=== C++ DSA LAB: GRAPH BFS & DFS TRAVERSALS ===\n";
    cout << "Enter number of vertices (V): ";
    if (!(cin >> vertices) || vertices < 1 || vertices > 100) return 1;
    cout << "Enter number of edges (E): ";
    if (!(cin >> edges) || edges < 0) return 1;
    Graph graph(vertices);
    cout << "Enter edges (u v) for undirected graph:\n";
    for (int i = 0; i < edges; ++i) {
        if (!(cin >> u >> v) || u < 0 || v < 0 || u >= vertices || v >= vertices) return 1;
        graph.addEdge(u, v);
    }
    cout << "Enter starting vertex for traversals: ";
    if (!(cin >> source) || source < 0 || source >= vertices) return 1;
    cout << "Breadth First Search (BFS) Traversal: "; graph.BFS(source);
    cout << "Depth First Search (DFS) Traversal: "; graph.DFS(source);
    return 0;
}''',
    "dijkstra_shortest_path.cpp": r'''int main() {
    int vertices, edges, source, u, v, weight;
    cout << "=== C++ DSA LAB: DIJKSTRA'S SHORTEST PATH ALGORITHM ===\n";
    cout << "Enter number of vertices (V): ";
    if (!(cin >> vertices) || vertices < 1 || vertices > 100) return 1;
    cout << "Enter number of directed weighted edges (E): ";
    if (!(cin >> edges) || edges < 0) return 1;
    vector<vector<int>> graph(vertices, vector<int>(vertices, INF));
    cout << "Enter edges (source destination weight):\n";
    for (int i = 0; i < edges; ++i) {
        if (!(cin >> u >> v >> weight) || u < 0 || v < 0 ||
            u >= vertices || v >= vertices || weight < 0) return 1;
        graph[u][v] = min(graph[u][v], weight);
    }
    cout << "Enter source vertex: ";
    if (!(cin >> source) || source < 0 || source >= vertices) return 1;
    vector<int> distance(vertices, INF), parent(vertices, -1);
    vector<bool> done(vertices, false);
    distance[source] = 0;
    for (int step = 0; step < vertices; ++step) {
        int current = minDistance(distance, done, vertices);
        if (current < 0 || distance[current] == INF) break;
        done[current] = true;
        for (int next = 0; next < vertices; ++next)
            if (!done[next] && graph[current][next] != INF &&
                distance[current] <= INF - graph[current][next] &&
                distance[current] + graph[current][next] < distance[next]) {
                distance[next] = distance[current] + graph[current][next];
                parent[next] = current;
            }
    }
    cout << "DESTINATION | DISTANCE | SHORTEST PATH\n";
    for (int destination = 0; destination < vertices; ++destination) {
        cout << destination << " | ";
        if (distance[destination] == INF) { cout << "unreachable | -\n"; continue; }
        cout << distance[destination] << " | ";
        vector<int> path;
        for (int at = destination; at != -1; at = parent[at]) path.push_back(at);
        for (int i = static_cast<int>(path.size()) - 1; i >= 0; --i)
            cout << path[i] << (i ? " -> " : "\n");
    }
    return 0;
}''',
}


def source_for(exercise):
    filename = exercise["filename"]
    if filename in FULL_PROGRAMS:
        return FULL_PROGRAMS[filename]
    if filename in MAIN_OVERRIDES:
        prefix, marker, _ = exercise["code"].partition("int main() {")
        if not marker:
            raise ValueError(f"Expected main() in {filename}")
        return prefix + MAIN_OVERRIDES[filename]
    return exercise["code"]
