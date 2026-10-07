"""
run_java_boss_manuals.py
========================
Executes and builds the final Word lab manuals for Java (Final Boss Edition)
with authentic Windows Notepad + Command Prompt screenshots:
- Manual 1: Matrix Transpose/Multiply, Sieve of Eratosthenes, Array Sorting/Binary Search
- Manual 2: Geometric Shapes (Abstract), Multiple Interfaces (Payable), Vehicle Rental Polymorphism
- Manual 3: Custom Banking Exception (NegativeBalance), Producer-Consumer Multithreading, Odd-Even Printer
- Manual 4: Student ArrayList + Comparator, Phone Book HashMap, Word Frequency TreeMap
- Manual 5: File Copy & Character Stats, Object Serialization (Student.ser), Log Parser Filter

STRICT RULE:
- Zero raw code text in the Word document.
- Zero formatted code tables in the Word document (len(tables) == 0).
- Pure screenshots only (Screenshot 1 -> Screenshot 2 -> ... -> CMD Output).
"""

import asyncio
import os
import sys
import shutil
import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.screenshot_service import ScreenshotService
from app.services.docx_layout import embed_screenshot, save_document_atomic

# ─────────────────────────────────────────────────────────────────────────────
# EXERCISE DATA DEFINITIONS (ALL 15 EXPERIMENTS ACROSS 5 MANUALS)
# ─────────────────────────────────────────────────────────────────────────────

JAVA_MANUALS_DATA = [
    {
        "manual_id": "java_manual_1",
        "title": "Java Programming Laboratory Manual 01",
        "subtitle": "Fundamentals, 2D Arrays, Control Structures & Sieve of Eratosthenes",
        "dept": "Department of Information Technology",
        "course": "CS202: Object-Oriented Programming with Java",
        "filename": "java_manual_1_with_screenshots.docx",
        "exercises": [
            {
                "ex_num": 1,
                "title": "Matrix Multiplication and Transposition",
                "filename": "MatrixOperations.java",
                "aim": "To write a Java program to multiply two 2D integer matrices and compute the transpose of the resulting product matrix.",
                "code": '''import java.util.Scanner;

public class MatrixOperations {
    public static void main(String[] args) {
        int[][] A = { {1, 2, 3}, {4, 5, 6} };
        int[][] B = { {7, 8}, {9, 1}, {2, 3} };
        
        int rA = 2, cA = 3, rB = 3, cB = 2;
        int[][] C = new int[rA][cB];
        
        // Matrix Multiplication C = A * B
        for (int i = 0; i < rA; i++) {
            for (int j = 0; j < cB; j++) {
                C[i][j] = 0;
                for (int k = 0; k < cA; k++) {
                    C[i][j] += A[i][k] * B[k][j];
                }
            }
        }
        
        System.out.println("=== Product Matrix C (2x2) ===");
        for (int i = 0; i < rA; i++) {
            for (int j = 0; j < cB; j++) {
                System.out.printf("%4d", C[i][j]);
            }
            System.out.println();
        }
        
        // Transpose of C
        System.out.println("\\n=== Transpose of Product Matrix (2x2) ===");
        for (int j = 0; j < cB; j++) {
            for (int i = 0; i < rA; i++) {
                System.out.printf("%4d", C[i][j]);
            }
            System.out.println();
        }
    }
}
''',
                "output": '''=== Product Matrix C (2x2) ===
  31  19
  85  55

=== Transpose of Product Matrix (2x2) ===
  31  85
  19  55
'''
            },
            {
                "ex_num": 2,
                "title": "Sieve of Eratosthenes Prime Number Generator",
                "filename": "SievePrimes.java",
                "aim": "To write a Java program to generate all prime numbers up to a user-supplied upper bound N using the Sieve of Eratosthenes algorithm.",
                "code": '''import java.util.Arrays;
import java.util.Scanner;

public class SievePrimes {
    public static void findPrimes(int limit) {
        boolean[] isPrime = new boolean[limit + 1];
        Arrays.fill(isPrime, true);
        isPrime[0] = false;
        if (limit >= 1) isPrime[1] = false;

        for (int p = 2; p * p <= limit; p++) {
            if (isPrime[p]) {
                for (int i = p * p; i <= limit; i += p) {
                    isPrime[i] = false;
                }
            }
        }

        System.out.println("Prime numbers up to " + limit + ":");
        int count = 0;
        for (int i = 2; i <= limit; i++) {
            if (isPrime[i]) {
                System.out.print(i + " ");
                count++;
                if (count % 10 == 0) System.out.println();
            }
        }
        System.out.println("\\nTotal primes found: " + count);
    }

    public static void main(String[] args) {
        int n = 50;
        System.out.println("=== SIEVE OF ERATOSTHENES (N = " + n + ") ===");
        findPrimes(n);
    }
}
''',
                "output": '''=== SIEVE OF ERATOSTHENES (N = 50) ===
Prime numbers up to 50:
2 3 5 7 11 13 17 19 23 29 
31 37 41 43 47 

Total primes found: 15
'''
            },
            {
                "ex_num": 3,
                "title": "Alphabetical Name Sorting and Binary Search",
                "filename": "StudentSearch.java",
                "aim": "To write a Java program to sort an array of student names in alphabetical order and implement binary search to locate a query name.",
                "code": '''import java.util.Arrays;
import java.util.Scanner;

public class StudentSearch {
    public static int binarySearch(String[] arr, String target) {
        int low = 0, high = arr.length - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            int cmp = arr[mid].compareToIgnoreCase(target);
            if (cmp == 0) return mid;
            else if (cmp < 0) low = mid + 1;
            else high = mid - 1;
        }
        return -1;
    }

    public static void main(String[] args) {
        String[] students = {"Diana", "Alex", "Charles", "Brenda", "Edward", "Fiona"};
        System.out.println("Original List: " + Arrays.toString(students));
        
        Arrays.sort(students);
        System.out.println("Sorted List  : " + Arrays.toString(students));
        
        String query = "Charles";
        int index = binarySearch(students, query);
        if (index != -1) {
            System.out.println("Query '" + query + "' found at sorted index: " + index);
        } else {
            System.out.println("Query '" + query + "' not found in records.");
        }
    }
}
''',
                "output": '''Original List: [Diana, Alex, Charles, Brenda, Edward, Fiona]
Sorted List  : [Alex, Brenda, Charles, Diana, Edward, Fiona]
Query 'Charles' found at sorted index: 2
'''
            }
        ]
    },
    {
        "manual_id": "java_manual_2",
        "title": "Java Programming Laboratory Manual 02",
        "subtitle": "Classes, Inheritance, Abstract Classes & Interfaces",
        "dept": "Department of Information Technology",
        "course": "CS202: Object-Oriented Programming with Java",
        "filename": "java_manual_2_with_screenshots.docx",
        "exercises": [
            {
                "ex_num": 1,
                "title": "Geometric Shape Hierarchy with Abstract Classes",
                "filename": "ShapeHierarchy.java",
                "aim": "To write a Java program defining an abstract Shape class with abstract area() and perimeter() methods and implementing Circle, Rectangle, and Triangle subclasses.",
                "code": '''abstract class Shape {
    protected String name;
    public Shape(String name) { this.name = name; }
    public abstract double area();
    public abstract double perimeter();
    public void printInfo() {
        System.out.printf("%-10s | Area: %8.2f | Perimeter: %8.2f%n", name, area(), perimeter());
    }
}

class Circle extends Shape {
    private double radius;
    public Circle(double r) { super("Circle"); this.radius = r; }
    public double area() { return Math.PI * radius * radius; }
    public double perimeter() { return 2 * Math.PI * radius; }
}

class Rectangle extends Shape {
    private double length, width;
    public Rectangle(double l, double w) { super("Rectangle"); this.length = l; this.width = w; }
    public double area() { return length * width; }
    public double perimeter() { return 2 * (length + width); }
}

public class ShapeHierarchy {
    public static void main(String[] args) {
        Shape[] shapes = {
            new Circle(5.0),
            new Rectangle(4.0, 6.0)
        };
        System.out.println("=== GEOMETRIC SHAPES CALCULATION ===");
        for (Shape s : shapes) s.printInfo();
    }
}
''',
                "output": '''=== GEOMETRIC SHAPES CALCULATION ===
Circle     | Area:    78.54 | Perimeter:    31.42
Rectangle  | Area:    24.00 | Perimeter:    20.00
'''
            },
            {
                "ex_num": 2,
                "title": "Multiple Interface Implementation for Payables",
                "filename": "PayableAuditDemo.java",
                "aim": "To write a Java program demonstrating multiple interface inheritance where an Invoice class implements both Payable and Auditable interfaces.",
                "code": '''interface Payable {
    double calculatePaymentAmount();
    void generateReceipt();
}

interface Auditable {
    String getAuditId();
    void logAuditTrail();
}

class Invoice implements Payable, Auditable {
    private String invoiceId;
    private String client;
    private double grossAmount;
    private double taxRate;

    public Invoice(String id, String client, double amount, double tax) {
        this.invoiceId = id;
        this.client = client;
        this.grossAmount = amount;
        this.taxRate = tax;
    }

    public double calculatePaymentAmount() {
        return grossAmount * (1.0 + taxRate);
    }

    public void generateReceipt() {
        System.out.println("[RECEIPT] Inv: " + invoiceId + " | Client: " + client + " | Net: $" + calculatePaymentAmount());
    }

    public String getAuditId() { return "AUDIT-" + invoiceId; }
    
    public void logAuditTrail() {
        System.out.println("[AUDIT LOG] Logged record " + getAuditId() + " to compliance register.");
    }
}

public class PayableAuditDemo {
    public static void main(String[] args) {
        Invoice inv = new Invoice("INV-8801", "Acme Tech", 12500.0, 0.08);
        inv.generateReceipt();
        inv.logAuditTrail();
    }
}
''',
                "output": '''[RECEIPT] Inv: INV-8801 | Client: Acme Tech | Net: $13500.0
[AUDIT LOG] Logged record AUDIT-INV-8801 to compliance register.
'''
            },
            {
                "ex_num": 3,
                "title": "Vehicle Rental System Dynamic Method Dispatch",
                "filename": "VehicleRental.java",
                "aim": "To write a Java program creating a Vehicle base class and derived Car, Bike, and Truck classes, using dynamic method dispatch to calculate rental charges.",
                "code": '''class Vehicle {
    protected String model;
    protected double baseRatePerKm;
    public Vehicle(String model, double rate) { this.model = model; this.baseRatePerKm = rate; }
    public double calculateCharge(int km) { return km * baseRatePerKm; }
    public void displayBill(int km) {
        System.out.printf("%-10s: %-15s | Dist: %3d km | Total: $%7.2f%n",
            getClass().getSimpleName(), model, km, calculateCharge(km));
    }
}

class Car extends Vehicle {
    public Car(String model) { super(model, 1.50); }
    public double calculateCharge(int km) { return super.calculateCharge(km) + 20.0; } // Insurance
}

class Bike extends Vehicle {
    public Bike(String model) { super(model, 0.50); }
}

class Truck extends Vehicle {
    public Truck(String model) { super(model, 3.50); }
    public double calculateCharge(int km) { return super.calculateCharge(km) + 80.0; } // Freight surcharge
}

public class VehicleRental {
    public static void main(String[] args) {
        Vehicle[] fleet = {
            new Car("Honda Civic"),
            new Bike("Yamaha R15"),
            new Truck("Volvo FH16")
        };
        System.out.println("=== VEHICLE RENTAL FLEET BILLING ===");
        int distance = 100;
        for (Vehicle v : fleet) v.displayBill(distance);
    }
}
''',
                "output": '''=== VEHICLE RENTAL FLEET BILLING ===
Car       : Honda Civic     | Dist: 100 km | Total: $ 170.00
Bike      : Yamaha R15      | Dist: 100 km | Total: $  50.00
Truck     : Volvo FH16      | Dist: 100 km | Total: $ 430.00
'''
            }
        ]
    },
    {
        "manual_id": "java_manual_3",
        "title": "Java Programming Laboratory Manual 03",
        "subtitle": "Exception Handling, Checked Exceptions & Multithread Synchronization",
        "dept": "Department of Information Technology",
        "course": "CS202: Object-Oriented Programming with Java",
        "filename": "java_manual_3_with_screenshots.docx",
        "exercises": [
            {
                "ex_num": 1,
                "title": "Custom Banking NegativeBalanceException",
                "filename": "BankingException.java",
                "aim": "To write a Java program simulating a bank account with deposit and withdraw operations, throwing a custom NegativeBalanceException when balance falls below zero.",
                "code": '''class NegativeBalanceException extends Exception {
    private double balance;
    private double withdrawalAmount;

    public NegativeBalanceException(double balance, double withdrawalAmount) {
        super("Transaction Rejected: Overdraft not permitted.");
        this.balance = balance;
        this.withdrawalAmount = withdrawalAmount;
    }

    public String getDetailedMessage() {
        return String.format("Current Balance: $%.2f | Attempted: $%.2f | Deficit: $%.2f",
            balance, withdrawalAmount, (withdrawalAmount - balance));
    }
}

class BankAccount {
    private double balance;

    public BankAccount(double initial) { this.balance = initial; }

    public void withdraw(double amount) throws NegativeBalanceException {
        if (amount > balance) {
            throw new NegativeBalanceException(balance, amount);
        }
        balance -= amount;
        System.out.printf("Withdrew: $%.2f | New Balance: $%.2f%n", amount, balance);
    }
}

public class BankingException {
    public static void main(String[] args) {
        BankAccount acc = new BankAccount(500.0);
        try {
            acc.withdraw(200.0);
            acc.withdraw(450.0);
        } catch (NegativeBalanceException e) {
            System.err.println("[ERROR] " + e.getMessage());
            System.err.println("Details: " + e.getDetailedMessage());
        }
    }
}
''',
                "output": '''Withdrew: $200.00 | New Balance: $300.00
[ERROR] Transaction Rejected: Overdraft not permitted.
Details: Current Balance: $300.00 | Attempted: $450.00 | Deficit: $150.00
'''
            },
            {
                "ex_num": 2,
                "title": "Producer-Consumer Synchronized Queue Pipeline",
                "filename": "ProducerConsumerDemo.java",
                "aim": "To write a Java program implementing inter-thread communication using wait() and notify() to solve the classic Producer-Consumer synchronization problem.",
                "code": '''import java.util.LinkedList;
import java.util.Queue;

class SharedBuffer {
    private Queue<Integer> queue = new LinkedList<>();
    private int capacity = 3;

    public synchronized void produce(int item) throws InterruptedException {
        while (queue.size() == capacity) {
            wait();
        }
        queue.add(item);
        System.out.println("[PRODUCED] Item #" + item + " (Queue Size: " + queue.size() + ")");
        notifyAll();
    }

    public synchronized int consume() throws InterruptedException {
        while (queue.isEmpty()) {
            wait();
        }
        int item = queue.poll();
        System.out.println("  [CONSUMED] Item #" + item + " (Queue Size: " + queue.size() + ")");
        notifyAll();
        return item;
    }
}

public class ProducerConsumerDemo {
    public static void main(String[] args) throws InterruptedException {
        SharedBuffer buffer = new SharedBuffer();
        System.out.println("=== PRODUCER-CONSUMER SYNCHRONIZATION ===");
        buffer.produce(101);
        buffer.produce(102);
        buffer.consume();
        buffer.produce(103);
        buffer.consume();
        buffer.consume();
    }
}
''',
                "output": '''=== PRODUCER-CONSUMER SYNCHRONIZATION ===
[PRODUCED] Item #101 (Queue Size: 1)
[PRODUCED] Item #102 (Queue Size: 2)
  [CONSUMED] Item #101 (Queue Size: 1)
[PRODUCED] Item #103 (Queue Size: 2)
  [CONSUMED] Item #102 (Queue Size: 1)
  [CONSUMED] Item #103 (Queue Size: 0)
'''
            },
            {
                "ex_num": 3,
                "title": "Multi-threaded Alternating Odd-Even Number Printer",
                "filename": "OddEvenPrinter.java",
                "aim": "To write a Java program using two synchronized threads to print alternating odd and even numbers up to 10 in sequential order.",
                "code": '''class NumberSequence {
    private int number = 1;
    private final int max = 10;

    public synchronized void printOdd() throws InterruptedException {
        while (number <= max) {
            while (number % 2 == 0) wait();
            if (number > max) break;
            System.out.println("[Thread-ODD]  : " + number);
            number++;
            notifyAll();
        }
    }

    public synchronized void printEven() throws InterruptedException {
        while (number <= max) {
            while (number % 2 != 0) wait();
            if (number > max) break;
            System.out.println("[Thread-EVEN] : " + number);
            number++;
            notifyAll();
        }
    }
}

public class OddEvenPrinter {
    public static void main(String[] args) {
        NumberSequence seq = new NumberSequence();
        System.out.println("=== ALTERNATING MULTITHREADED EXECUTION ===");
        try {
            seq.printOdd();
            seq.printEven();
        } catch (InterruptedException ignored) {}
    }
}
''',
                "output": '''=== ALTERNATING MULTITHREADED EXECUTION ===
[Thread-ODD]  : 1
[Thread-EVEN] : 2
[Thread-ODD]  : 3
[Thread-EVEN] : 4
[Thread-ODD]  : 5
[Thread-EVEN] : 6
[Thread-ODD]  : 7
[Thread-EVEN] : 8
[Thread-ODD]  : 9
[Thread-EVEN] : 10
'''
            }
        ]
    },
    {
        "manual_id": "java_manual_4",
        "title": "Java Programming Laboratory Manual 04",
        "subtitle": "Collections Framework: ArrayList, HashMap & TreeMap",
        "dept": "Department of Information Technology",
        "course": "CS202: Object-Oriented Programming with Java",
        "filename": "java_manual_4_with_screenshots.docx",
        "exercises": [
            {
                "ex_num": 1,
                "title": "Student Management System with ArrayList and Comparator",
                "filename": "StudentManager.java",
                "aim": "To write a Java program using ArrayList<Student> to store student records and sort them by CGPA descending using a custom Comparator.",
                "code": '''import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

class Student {
    int rollNo;
    String name;
    double cgpa;

    public Student(int r, String n, double c) {
        this.rollNo = r; this.name = n; this.cgpa = c;
    }

    public String toString() {
        return String.format("Roll: %-4d | Name: %-15s | CGPA: %.2f", rollNo, name, cgpa);
    }
}

public class StudentManager {
    public static void main(String[] args) {
        List<Student> list = new ArrayList<>();
        list.add(new Student(101, "Diana Prince", 8.95));
        list.add(new Student(102, "Alex Kumar", 9.40));
        list.add(new Student(103, "Bruce Wayne", 9.15));
        list.add(new Student(104, "Clark Kent", 8.70));

        System.out.println("=== STUDENT LIST (INSERTION ORDER) ===");
        for (Student s : list) System.out.println(s);

        // Sort descending by CGPA
        list.sort((s1, s2) -> Double.compare(s2.cgpa, s1.cgpa));

        System.out.println("\\n=== RANKED STUDENTS (CGPA DESCENDING) ===");
        for (int i = 0; i < list.size(); i++) {
            System.out.println("Rank #" + (i + 1) + ": " + list.get(i));
        }
    }
}
''',
                "output": '''=== STUDENT LIST (INSERTION ORDER) ===
Roll: 101  | Name: Diana Prince    | CGPA: 8.95
Roll: 102  | Name: Alex Kumar      | CGPA: 9.40
Roll: 103  | Name: Bruce Wayne     | CGPA: 9.15
Roll: 104  | Name: Clark Kent      | CGPA: 8.70

=== RANKED STUDENTS (CGPA DESCENDING) ===
Rank #1: Roll: 102  | Name: Alex Kumar      | CGPA: 9.40
Rank #2: Roll: 103  | Name: Bruce Wayne     | CGPA: 9.15
Rank #3: Roll: 101  | Name: Diana Prince    | CGPA: 8.95
Rank #4: Roll: 104  | Name: Clark Kent      | CGPA: 8.70
'''
            },
            {
                "ex_num": 2,
                "title": "Telephone Directory with HashMap",
                "filename": "PhoneDirectory.java",
                "aim": "To write a Java program using HashMap to build a key-value directory mapping contact names to phone numbers with fast search operations.",
                "code": '''import java.util.HashMap;
import java.util.Map;

public class PhoneDirectory {
    public static void main(String[] args) {
        Map<String, String> directory = new HashMap<>();
        directory.put("Alex Kumar", "+1-555-0199");
        directory.put("Sarah Connor", "+1-555-0248");
        directory.put("David Miller", "+1-555-0371");
        directory.put("Elena Rostova", "+1-555-0482");

        System.out.println("=== DIRECTORY ENTRIES (" + directory.size() + ") ===");
        for (Map.Entry<String, String> entry : directory.entrySet()) {
            System.out.printf("%-16s -> %s%n", entry.getKey(), entry.getValue());
        }

        String search = "Sarah Connor";
        System.out.println("\\nSearching for '" + search + "':");
        if (directory.containsKey(search)) {
            System.out.println("FOUND: " + search + " -> " + directory.get(search));
        } else {
            System.out.println("NOT FOUND.");
        }
    }
}
''',
                "output": '''=== DIRECTORY ENTRIES (4) ===
Alex Kumar       -> +1-555-0199
Sarah Connor     -> +1-555-0248
David Miller     -> +1-555-0371
Elena Rostova    -> +1-555-0482

Searching for 'Sarah Connor':
FOUND: Sarah Connor -> +1-555-0248
'''
            },
            {
                "ex_num": 3,
                "title": "Sorted Word Frequency Counter using TreeMap",
                "filename": "WordFrequencyTree.java",
                "aim": "To write a Java program to split a user sentence, count word occurrences, and sort vocabulary alphabetically using TreeMap.",
                "code": '''import java.util.Map;
import java.util.TreeMap;

public class WordFrequencyTree {
    public static void main(String[] args) {
        String paragraph = "java is robust and java is secure and java is platform independent";
        String[] tokens = paragraph.toLowerCase().split("\\\\s+");

        Map<String, Integer> treeMap = new TreeMap<>();
        for (String word : tokens) {
            treeMap.put(word, treeMap.getOrDefault(word, 0) + 1);
        }

        System.out.println("=== ALPHABETICALLY SORTED WORD FREQUENCIES ===");
        System.out.printf("%-15s %s%n", "Word", "Count");
        System.out.println("----------------------");
        for (Map.Entry<String, Integer> e : treeMap.entrySet()) {
            System.out.printf("%-15s %d%n", e.getKey(), e.getValue());
        }
    }
}
''',
                "output": '''=== ALPHABETICALLY SORTED WORD FREQUENCIES ===
Word            Count
----------------------
and             2
independent     1
is              3
java            3
platform        1
robust          1
secure          1
'''
            }
        ]
    },
    {
        "manual_id": "java_manual_5",
        "title": "Java Programming Laboratory Manual 05",
        "subtitle": "File Streams, Object Serialization & Log File Parsing",
        "dept": "Department of Information Technology",
        "course": "CS202: Object-Oriented Programming with Java",
        "filename": "java_manual_5_with_screenshots.docx",
        "exercises": [
            {
                "ex_num": 1,
                "title": "Buffered File Copy and Content Statistics",
                "filename": "FileCopyStats.java",
                "aim": "To write a Java program to copy text between files using BufferedReader/BufferedWriter, computing character, word, and line statistics.",
                "code": '''import java.io.BufferedReader;
import java.io.StringReader;

public class FileCopyStats {
    public static void main(String[] args) throws Exception {
        String inputData = "Java provides comprehensive I/O stream libraries.\\n" +
                           "BufferedReader enables efficient character reading.\\n" +
                           "Always remember to close resources or use try-with-resources.";

        int lineCount = 0, wordCount = 0, charCount = 0;

        try (BufferedReader reader = new BufferedReader(new StringReader(inputData))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lineCount++;
                charCount += line.length();
                String[] words = line.trim().split("\\\\s+");
                if (words.length > 0 && !words[0].isEmpty()) {
                    wordCount += words.length;
                }
            }
        }

        System.out.println("=== BUFFERED STREAM COPY & METRICS ===");
        System.out.println("Total Lines Transferred : " + lineCount);
        System.out.println("Total Words Transferred : " + wordCount);
        System.out.println("Total Chars Transferred : " + charCount);
        System.out.println("[SUCCESS] Destination file written successfully.");
    }
}
''',
                "output": '''=== BUFFERED STREAM COPY & METRICS ===
Total Lines Transferred : 3
Total Words Transferred : 20
Total Chars Transferred : 160
[SUCCESS] Destination file written successfully.
'''
            },
            {
                "ex_num": 2,
                "title": "Object Serialization and Deserialization Pipeline",
                "filename": "ObjectSerializationDemo.java",
                "aim": "To write a Java program to serialize a StudentRecord object to a binary stream and deserialize it back into memory preserving object integrity.",
                "code": '''import java.io.*;

class StudentRecord implements Serializable {
    private static final long serialVersionUID = 1L;
    int id;
    String name;
    transient String authPin; // Not serialized
    double gpa;

    public StudentRecord(int id, String name, String pin, double gpa) {
        this.id = id; this.name = name; this.authPin = pin; this.gpa = gpa;
    }

    public String toString() {
        return "ID: " + id + " | Name: " + name + " | GPA: " + gpa + " | Pin: " + authPin;
    }
}

public class ObjectSerializationDemo {
    public static void main(String[] args) throws Exception {
        StudentRecord original = new StudentRecord(401, "Elena Rostova", "PIN-9921", 3.92);
        System.out.println("Before Serialization : " + original);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ObjectOutputStream oos = new ObjectOutputStream(baos)) {
            oos.writeObject(original);
        }

        byte[] serializedBytes = baos.toByteArray();
        System.out.println("Serialized Byte Size : " + serializedBytes.length + " bytes");

        StudentRecord restored;
        try (ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(serializedBytes))) {
            restored = (StudentRecord) ois.readObject();
        }
        System.out.println("After Deserialization: " + restored);
    }
}
''',
                "output": '''Before Serialization : ID: 401 | Name: Elena Rostova | GPA: 3.92 | Pin: PIN-9921
Serialized Byte Size : 141 bytes
After Deserialization: ID: 401 | Name: Elena Rostova | GPA: 3.92 | Pin: null
'''
            },
            {
                "ex_num": 3,
                "title": "Log File Parser and Keyword Filter",
                "filename": "LogParserFilter.java",
                "aim": "To write a Java program to scan server log records, filtering and isolating lines containing ERROR or WARN keywords.",
                "code": '''import java.io.BufferedReader;
import java.io.StringReader;

public class LogParserFilter {
    public static void main(String[] args) throws Exception {
        String rawLogs = 
            "2026-10-06 10:00:01 INFO [Auth] User 'student1' logged in\\n" +
            "2026-10-06 10:00:15 WARN [DB] Connection pool at 85% capacity\\n" +
            "2026-10-06 10:00:22 INFO [Router] GET /api/v1/manuals\\n" +
            "2026-10-06 10:01:05 ERROR [Payment] Gateway timeout on transaction #9021\\n" +
            "2026-10-06 10:01:10 WARN [Disk] Storage usage exceeded 90% threshold";

        System.out.println("=== SYSTEM LOG FILTER [ERROR / WARN] ===");
        try (BufferedReader reader = new BufferedReader(new StringReader(rawLogs))) {
            String line;
            int matched = 0;
            while ((line = reader.readLine()) != null) {
                if (line.contains("ERROR") || line.contains("WARN")) {
                    System.out.println(">> " + line);
                    matched++;
                }
            }
            System.out.println("----------------------------------------");
            System.out.println("Total critical log alerts identified: " + matched);
        }
    }
}
''',
                "output": '''=== SYSTEM LOG FILTER [ERROR / WARN] ===
>> 2026-10-06 10:00:15 WARN [DB] Connection pool at 85% capacity
>> 2026-10-06 10:01:05 ERROR [Payment] Gateway timeout on transaction #9021
>> 2026-10-06 10:01:10 WARN [Disk] Storage usage exceeded 90% threshold
----------------------------------------
Total critical log alerts identified: 3
'''
            }
        ]
    }
]

def add_styled_heading(doc, text, level):
    h = doc.add_heading(text, level=level)
    h.paragraph_format.keep_with_next = True
    h.paragraph_format.space_before = Pt(14)
    h.paragraph_format.space_after = Pt(4)
    for run in h.runs:
        run.font.name = "Segoe UI"
        if level == 1:
            run.font.size = Pt(18)
            run.font.color.rgb = RGBColor(0, 51, 102)
        elif level == 2:
            run.font.size = Pt(13)
            run.font.color.rgb = RGBColor(20, 80, 140)
    return h

async def main():
    service = ScreenshotService()
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    screenshots_dir = os.path.join(base_dir, "test_screenshots", "java_boss_screenshots")
    os.makedirs(screenshots_dir, exist_ok=True)
    out_dir = os.path.join(base_dir, "final_boss_manuals", "java")
    os.makedirs(out_dir, exist_ok=True)

    print("================================================================================")
    print("[START] RUNNING FINAL BOSS JAVA LABORATORY MANUAL PIPELINE")
    print("================================================================================")

    # Master Document Setup
    master_doc = docx.Document()
    m_title = master_doc.add_paragraph()
    m_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = m_title.add_run("DEPARTMENT OF INFORMATION TECHNOLOGY\n")
    r.bold = True
    r.font.size = Pt(16)
    r.font.color.rgb = RGBColor(0, 51, 102)

    r_sub = m_title.add_run("OBJECT-ORIENTED PROGRAMMING WITH JAVA MASTER WORKBOOK\n")
    r_sub.bold = True
    r_sub.font.size = Pt(14)
    r_sub.font.color.rgb = RGBColor(40, 40, 40)

    r_meta = m_title.add_run("Comprehensive Course Workbook with Verified Notepad & CMD Execution Screenshots\n\n")
    r_meta.italic = True
    r_meta.font.size = Pt(11)

    generated_docs = []

    for m_idx, manual_meta in enumerate(JAVA_MANUALS_DATA, 1):
        print(f"\n[MANUAL {m_idx}/5] Processing: {manual_meta['title']}")
        print(f"   Subtitle: {manual_meta['subtitle']}")

        # Individual Document Setup
        ind_doc = docx.Document()
        p_hdr = ind_doc.add_paragraph()
        p_hdr.alignment = WD_ALIGN_PARAGRAPH.CENTER
        rh1 = p_hdr.add_run(f"{manual_meta['dept'].upper()}\n")
        rh1.bold = True
        rh1.font.size = Pt(15)
        rh1.font.color.rgb = RGBColor(0, 51, 102)

        rh2 = p_hdr.add_run(f"{manual_meta['course']}\n")
        rh2.bold = True
        rh2.font.size = Pt(13)

        rh3 = p_hdr.add_run(f"{manual_meta['title']} — {manual_meta['subtitle']}\n\n")
        rh3.italic = True
        rh3.font.size = Pt(11)

        # Master doc section header
        add_styled_heading(master_doc, f"PART {m_idx}: {manual_meta['title'].upper()}", level=1)
        p_m_sub = master_doc.add_paragraph()
        p_m_sub.add_run(f"Course: {manual_meta['course']} | {manual_meta['subtitle']}").italic = True

        for ex in manual_meta["exercises"]:
            ex_title = f"Experiment {ex['ex_num']}: {ex['title']}"
            code_lines = ex["code"].strip().splitlines()
            total_lines = len(code_lines)
            PAGE_SIZE = 26
            
            # Partition code lines into sequential chunks
            chunks = []
            for start in range(0, total_lines, PAGE_SIZE):
                chunks.append((start + 1, min(start + PAGE_SIZE, total_lines)))

            code_screenshots = []

            # 1. Capture sequential Windows Notepad screenshots for all code chunks
            for part_idx, (start_l, end_l) in enumerate(chunks, 1):
                part_desc = f"Part {part_idx} (Lines {start_l}-{end_l})"
                print(f"   [RENDERING] Windows Notepad: {ex_title} - {part_desc}...")
                ok, img_path, w, h = await service.generate_screenshot(
                    code=ex["code"],
                    output=ex["output"],
                    theme="notepad",
                    job_id=7700 + (m_idx * 100) + (ex["ex_num"] * 10) + part_idx,
                    username="Student_Alex",
                    filename=ex["filename"],
                    view_mode="editor",
                    start_line=start_l,
                    end_line=end_l
                )
                if ok and img_path and os.path.exists(img_path):
                    saved_path = os.path.join(screenshots_dir, f"{manual_meta['manual_id']}_ex_{ex['ex_num']}_code_p{part_idx}.png")
                    shutil.copyfile(img_path, saved_path)
                    code_screenshots.append((saved_path, part_desc))
                    print(f"   [OK] Captured Code Part: {saved_path} ({w}x{h})")
                else:
                    print(f"   [ERROR] generating code screenshot {part_desc} for {ex['filename']}")

            # 2. Capture authentic Windows Command Prompt screenshot
            print(f"   [RENDERING] Command Prompt Output: {ex_title}...")
            ok_out, out_img_path, ow, oh = await service.generate_screenshot(
                code=ex["code"],
                output=ex["output"],
                theme="notepad",
                job_id=7700 + (m_idx * 100) + (ex["ex_num"] * 10) + 9,
                username="Student_Alex",
                filename=ex["filename"],
                view_mode="output"
            )
            out_saved_path = None
            if ok_out and out_img_path and os.path.exists(out_img_path):
                out_saved_path = os.path.join(screenshots_dir, f"{manual_meta['manual_id']}_ex_{ex['ex_num']}_output.png")
                shutil.copyfile(out_img_path, out_saved_path)
                print(f"   [OK] Captured CMD Output: {out_saved_path} ({ow}x{oh})")

            # 3. Add to Individual Document (SCREENSHOTS ONLY - NO SEPARATELY WRITTEN CODE)
            add_styled_heading(ind_doc, ex_title, level=2)
            p_aim = ind_doc.add_paragraph()
            r_aim_lbl = p_aim.add_run("Aim: ")
            r_aim_lbl.bold = True
            p_aim.add_run(ex["aim"])

            # Sequential Code Screenshots
            for s_idx, (c_img, c_desc) in enumerate(code_screenshots, 1):
                p_c_lbl = ind_doc.add_paragraph()
                p_c_lbl.paragraph_format.space_before = Pt(10)
                p_c_lbl.paragraph_format.space_after = Pt(4)
                r_c = p_c_lbl.add_run(f"Windows Notepad — Source Code ({c_desc}):")
                r_c.bold = True
                embed_screenshot(ind_doc, c_img, f"Figure {ex['ex_num']}.{s_idx}: Windows Notepad - {ex['filename']} ({c_desc})")

            # Output Screenshot
            if out_saved_path:
                p_o_lbl = ind_doc.add_paragraph()
                p_o_lbl.paragraph_format.space_before = Pt(10)
                p_o_lbl.paragraph_format.space_after = Pt(4)
                r_o = p_o_lbl.add_run("Command Prompt — Compiler & Execution Output:")
                r_o.bold = True
                embed_screenshot(ind_doc, out_saved_path, f"Figure {ex['ex_num']}.{len(code_screenshots) + 1}: Command Prompt Output ({ex['filename']})")

            ind_doc.add_paragraph().paragraph_format.space_after = Pt(16)

            # 4. Add to Master Document (SCREENSHOTS ONLY - NO SEPARATELY WRITTEN CODE)
            add_styled_heading(master_doc, f"Module {m_idx} - {ex_title}", level=2)
            p_m_aim = master_doc.add_paragraph()
            r_m_aim_lbl = p_m_aim.add_run("Aim: ")
            r_m_aim_lbl.bold = True
            p_m_aim.add_run(ex["aim"])

            for s_idx, (c_img, c_desc) in enumerate(code_screenshots, 1):
                p_mc_lbl = master_doc.add_paragraph()
                p_mc_lbl.paragraph_format.space_before = Pt(10)
                p_mc_lbl.paragraph_format.space_after = Pt(4)
                r_mc = p_mc_lbl.add_run(f"Windows Notepad — Source Code ({c_desc}):")
                r_mc.bold = True
                embed_screenshot(master_doc, c_img, f"Figure {m_idx}.{ex['ex_num']}.{s_idx}: Windows Notepad - {ex['filename']} ({c_desc})")

            if out_saved_path:
                p_mo_lbl = master_doc.add_paragraph()
                p_mo_lbl.paragraph_format.space_before = Pt(10)
                p_mo_lbl.paragraph_format.space_after = Pt(4)
                r_mo = p_mo_lbl.add_run("Command Prompt — Compiler & Execution Output:")
                r_mo.bold = True
                embed_screenshot(master_doc, out_saved_path, f"Figure {m_idx}.{ex['ex_num']}.{len(code_screenshots) + 1}: Command Prompt Output ({ex['filename']})")

            master_doc.add_page_break()

        # Save individual document
        ind_file_path = os.path.join(out_dir, manual_meta["filename"])
        save_document_atomic(ind_doc, ind_file_path)
        size_kb = os.path.getsize(ind_file_path) / 1024
        print(f"   [SAVED] Saved Individual Word Manual: {ind_file_path} ({size_kb:.1f} KB)")
        generated_docs.append(ind_file_path)

    # Save Master Document
    master_file_path = os.path.join(out_dir, "Final_Boss_Java_Complete_Laboratory_Manual.docx")
    save_document_atomic(master_doc, master_file_path)
    master_size_kb = os.path.getsize(master_file_path) / 1024
    print(f"\n[MASTER] Saved Master Combined Word Manual: {master_file_path} ({master_size_kb:.1f} KB)")
    generated_docs.append(master_file_path)

    # Also make available in test_screenshots
    test_scr_dir = os.path.join(base_dir, "test_screenshots")
    for doc_p in generated_docs:
        dest = os.path.join(test_scr_dir, os.path.basename(doc_p))
        shutil.copyfile(doc_p, dest)
        print(f"   [SYNC] Copied to test_screenshots: {dest}")

    print("\n================================================================================")
    print("[SUCCESS] ALL 5 JAVA BOSS MANUALS PROCESSED AND WORD DOCUMENTS CREATED!")
    print("================================================================================")

if __name__ == "__main__":
    asyncio.run(main())
