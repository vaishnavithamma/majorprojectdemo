import { useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  FileAudio,
  FileText,
  FileVideo,
  FolderLock,
  Lock,
  MoreVertical,
  Upload,
  X,
} from "lucide-react";

import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Card from "../../components/common/Card";

const initialEvidence = [
  {
    id: 1,
    name: "Emergency recording",
    type: "video",
    size: "12.4 MB",
    date: "Today, 10:42 AM",
    encrypted: true,
  },
  {
    id: 2,
    name: "Incident audio",
    type: "audio",
    size: "4.8 MB",
    date: "Yesterday, 8:15 PM",
    encrypted: true,
  },
  {
    id: 3,
    name: "Incident notes",
    type: "document",
    size: "28 KB",
    date: "Aug 6, 2026",
    encrypted: true,
  },
];

function EvidenceIcon({ type }) {
  if (type === "video") {
    return <FileVideo size={22} />;
  }

  if (type === "audio") {
    return <FileAudio size={22} />;
  }

  return <FileText size={22} />;
}

export default function EvidenceVault() {
  const fileInputRef = useRef(null);

  const [files, setFiles] =
    useState(initialEvidence);

  const [showUpload, setShowUpload] =
    useState(false);

  const handleFiles = (event) => {
    const selectedFiles = Array.from(
      event.target.files || []
    );

    const newFiles = selectedFiles.map(
      (file, index) => ({
        id: Date.now() + index,
        name: file.name,
        type: file.type.startsWith("video")
          ? "video"
          : file.type.startsWith("audio")
            ? "audio"
            : "document",
        size: `${(
          file.size /
          1024 /
          1024
        ).toFixed(2)} MB`,
        date: "Just now",
        encrypted: true,
      })
    );

    setFiles((previous) => [
      ...newFiles,
      ...previous,
    ]);

    setShowUpload(false);
  };

  return (
    <div className="dashboard-layout">
      <Header />

      <Sidebar />

      <main className="dashboard-main">
        <div className="dashboard-content">

          <div className="page-title-row">
            <div>
              <span className="eyebrow">
                SECURE STORAGE
              </span>

              <h1>Evidence Vault</h1>

              <p>
                Securely store emergency evidence
                and important incident files.
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => setShowUpload(true)}
            >
              <Upload size={18} />
              Upload Evidence
            </button>
          </div>

          {/* Security banner */}

          <Card className="vault-security">
            <div className="vault-lock">
              <Lock size={22} />
            </div>

            <div>
              <strong>
                Your evidence is encrypted
              </strong>

              <span>
                Files stored in your vault are
                protected and accessible only to you.
              </span>
            </div>

            <div className="vault-encrypted">
              <CheckCircle2 size={15} />
              ENCRYPTED
            </div>
          </Card>

          {/* Storage */}

          <Card className="storage-card">
            <div className="storage-header">
              <div>
                <span>
                  STORAGE USED
                </span>

                <strong>
                  17.2 MB
                </strong>
              </div>

              <span>
                17.2 MB / 1 GB
              </span>
            </div>

            <div className="storage-bar">
              <div />
            </div>
          </Card>

          {/* Evidence */}

          <div className="evidence-list">
            {files.map((file) => (
              <Card
                className="evidence-row"
                key={file.id}
              >
                <div
                  className={`evidence-icon ${file.type}`}
                >
                  <EvidenceIcon
                    type={file.type}
                  />
                </div>

                <div className="evidence-info">
                  <strong>{file.name}</strong>

                  <span>
                    {file.size} • {file.date}
                  </span>
                </div>

                <div className="evidence-secure">
                  <Lock size={13} />
                  Encrypted
                </div>

                <button className="evidence-menu">
                  <MoreVertical size={18} />
                </button>
              </Card>
            ))}
          </div>

          {/* Empty upload area */}

          <button
            className="vault-upload-area"
            onClick={() => setShowUpload(true)}
          >
            <div>
              <FolderLock size={28} />
            </div>

            <strong>
              Add secure evidence
            </strong>

            <span>
              Upload photos, videos, audio or documents
            </span>
          </button>

        </div>
      </main>

      {/* Upload modal */}

      {showUpload && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setShowUpload(false);
            }
          }}
        >
          <div className="modal-card upload-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  EVIDENCE VAULT
                </span>

                <h2>
                  Upload evidence
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setShowUpload(false)
                }
              >
                <X size={19} />
              </button>
            </div>

            <button
              className="file-drop-zone"
              onClick={() =>
                fileInputRef.current?.click()
              }
            >
              <div>
                <Upload size={25} />
              </div>

              <strong>
                Choose files
              </strong>

              <span>
                Photos, videos, audio and documents
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              onChange={handleFiles}
            />

            <div className="upload-note">
              <Lock size={14} />

              <span>
                Files will be securely encrypted
                before storage.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}