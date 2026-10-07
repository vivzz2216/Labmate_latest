"use client";

import React, { useState, useEffect } from "react";
import { UserCheck, Sparkles, Building2, BookOpen, Hash, User, X } from "lucide-react";
import { apiService } from "@/lib/api";
import { useAuth } from "@/contexts/BasicAuthContext";

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function StudentProfileModal({
  isOpen,
  onClose,
  onSaved,
}: StudentProfileModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [usn, setUsn] = useState("");
  const [department, setDepartment] = useState("");
  const [institution, setInstitution] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    apiService
      .getUserProfile()
      .then((data) => {
        if (!active) return;
        const profile = data?.profile || data || {};
        setName(user?.name || profile.name || "");
        setDepartment(profile.course || "Computer Science & Engineering");
        setInstitution(profile.institution || "Engineering College");
        const meta = profile.metadata || profile.profile_metadata || {};
        setUsn(meta.roll_number || meta.usn || meta.roll_no || "USN-2024-001");
      })
      .catch((err) => {
        console.error("Could not fetch profile:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, user?.name]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await apiService.updateUserProfile({
        course: department.trim(),
        institution: institution.trim(),
        profile_metadata: {
          roll_number: usn.trim(),
          usn: usn.trim(),
          department: department.trim(),
        },
      });
      setMessage("Profile saved successfully!");
      setTimeout(() => {
        if (onSaved) onSaved();
        onClose();
      }, 500);
    } catch (err: any) {
      console.error("Failed to save profile:", err);
      setMessage(err?.message || "Failed to save profile details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "520px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          animation: "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
            padding: "24px",
            color: "#ffffff",
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              background: "rgba(255, 255, 255, 0.15)",
              border: "none",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={22} color="#fbbf24" />
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
              Personalize Code Examples
            </h2>
          </div>
          <p style={{ fontSize: "13px", opacity: 0.88, margin: 0, lineHeight: 1.5 }}>
            Your real student credentials will be injected into all code classes, banking records,
            test cases, and IDE window paths instead of generic placeholders like John Doe.
          </p>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSave} style={{ padding: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Student Name */}
            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                <User size={15} color="#6366f1" /> Full Student Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "14px",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "10px",
                  outline: "none",
                  transition: "border 0.2s",
                }}
              />
            </div>

            {/* USN / Roll Number */}
            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                <Hash size={15} color="#6366f1" /> USN / Roll Number
              </label>
              <input
                type="text"
                value={usn}
                onChange={(e) => setUsn(e.target.value)}
                placeholder="e.g. 1MS21CS042"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "14px",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "10px",
                  outline: "none",
                }}
              />
            </div>

            {/* Branch / Department */}
            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                <BookOpen size={15} color="#6366f1" /> Branch / Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Computer Science & Engineering"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "14px",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "10px",
                  outline: "none",
                }}
              />
            </div>

            {/* College / Institution */}
            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                <Building2 size={15} color="#6366f1" /> College / Institution
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. Ramaiah Institute of Technology"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "14px",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "10px",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {message && (
            <div
              style={{
                marginTop: "16px",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                backgroundColor: message.includes("success") ? "#ecfdf5" : "#fef2f2",
                color: message.includes("success") ? "#065f46" : "#991b1b",
                border: `1px solid ${message.includes("success") ? "#a7f3d0" : "#fecaca"}`,
              }}
            >
              {message}
            </div>
          )}

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "24px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 18px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#64748b",
                background: "#f1f5f9",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              style={{
                padding: "10px 22px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#ffffff",
                background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                border: "none",
                borderRadius: "10px",
                cursor: saving ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.35)",
              }}
            >
              <UserCheck size={16} />
              {saving ? "Saving..." : "Save & Apply to Code"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
