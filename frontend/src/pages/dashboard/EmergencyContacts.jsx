import { useEffect, useState } from "react";
import axios from "axios";

import {
  CheckCircle2,
  Mail,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
  Loader2,
  AlertCircle,
  PhoneCall,
} from "lucide-react";

import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Card from "../../components/common/Card";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

export default function EmergencyContacts() {
  const [contacts, setContacts] = useState([]);

  const [showModal, setShowModal] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState(null);

  const [callingId, setCallingId] =
    useState(null);

  const [error, setError] =
    useState("");

  const [callMessage, setCallMessage] =
    useState("");

  const [form, setForm] = useState({
    name: "",
    relation: "",
    phone: "",
    email: "",
  });

  // =========================================================
  // AUTH CONFIG
  // =========================================================

  const getAuthConfig = () => {
    const token =
      localStorage.getItem("safeops_token");

    return {
      withCredentials: true,
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    };
  };

  // =========================================================
  // GET CONTACTS
  // =========================================================

  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get(
        `${API_URL}/emergency-contacts`,
        getAuthConfig()
      );

      const data = response.data;

      if (!data.success) {
        throw new Error(
          data.message ||
            "Unable to load emergency contacts."
        );
      }

      setContacts(data.contacts || []);
    } catch (err) {
      console.error(
        "Fetch emergency contacts error:",
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Unable to load emergency contacts.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // =========================================================
  // FORM CHANGE
  // =========================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  // =========================================================
  // ADD CONTACT
  // =========================================================

  const addContact = async (event) => {
    event.preventDefault();

    setError("");

    if (
      !form.name.trim() ||
      !form.relation.trim() ||
      !form.phone.trim()
    ) {
      setError(
        "Name, relationship and phone number are required."
      );

      return;
    }

    try {
      setSaving(true);

      const response = await axios.post(
        `${API_URL}/emergency-contacts`,
        {
          name: form.name.trim(),
          relation: form.relation.trim(),
          phone: form.phone.trim(),
        },
        getAuthConfig()
      );

      const data = response.data;

      if (!data.success) {
        throw new Error(
          data.message ||
            "Unable to add emergency contact."
        );
      }

      setContacts((previous) => [
        data.contact,
        ...previous,
      ]);

      setForm({
        name: "",
        relation: "",
        phone: "",
        email: "",
      });

      setShowModal(false);
    } catch (err) {
      console.error(
        "Add emergency contact error:",
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Unable to add emergency contact.";

      setError(message);
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // DELETE CONTACT
  // =========================================================

  const removeContact = async (id) => {
    try {
      setDeletingId(id);
      setError("");

      const response = await axios.delete(
        `${API_URL}/emergency-contacts/${id}`,
        getAuthConfig()
      );

      const data = response.data;

      if (!data.success) {
        throw new Error(
          data.message ||
            "Unable to delete contact."
        );
      }

      setContacts((previous) =>
        previous.filter(
          (contact) => contact.id !== id
        )
      );
    } catch (err) {
      console.error(
        "Delete emergency contact error:",
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Unable to delete emergency contact.";

      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  // =========================================================
  // TEST SAFEOPS CALL
  // =========================================================

  const testCall = async (contact) => {
    setError("");
    setCallMessage("");

    if (!contact?.phone) {
      setError(
        "This contact does not have a phone number."
      );

      return;
    }

    try {
      setCallingId(contact.id);

      // -----------------------------------------------------
      // IMPORTANT DEBUG INFORMATION
      // -----------------------------------------------------

      console.log(
        "📞 SafeOps contact being called:",
        {
          id: contact.id,
          name: contact.name,
          relation: contact.relation,
          phone: contact.phone,
        }
      );

      // -----------------------------------------------------
      // SEND CONTACT INFORMATION TO BACKEND
      // -----------------------------------------------------

      const requestBody = {
        phoneNumber: contact.phone,
        contactName: contact.name,
        relation: contact.relation,
      };

      console.log(
        "📤 Sending Twilio request:",
        requestBody
      );

      // 1. Immediately launch native cellular phone dialer
      const cleanPhone = contact.phone.replace(/[^0-9+]/g, "");
      if (cleanPhone) {
        window.location.href = `tel:${cleanPhone}`;
      }

      // 2. Simultaneously send Telegram alert with details
      try {
        await axios.post(
          `${API_URL}/telegram/test-alert`,
          {
            contactName: contact.name,
            relation: contact.relation,
            phone: contact.phone,
          },
          getAuthConfig()
        );
      } catch (tgErr) {
        console.warn("Telegram alert notification failed:", tgErr);
      }

      setCallMessage(
        `Calling ${contact.name} (${contact.phone})... Native call screen launched!`
      );
    } catch (err) {
      console.error(
        "❌ Test alert error:",
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Unable to send emergency alert.";

      setError(message);
    } finally {
      setCallingId(null);
    }
  };

  // =========================================================
  // CLOSE MODAL
  // =========================================================

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);

    setForm({
      name: "",
      relation: "",
      phone: "",
      email: "",
    });

    setError("");
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="dashboard-layout">

      <Header />

      <Sidebar />

      <main className="dashboard-main">
        <div className="dashboard-content">

          {/* =================================================
              PAGE HEADING
          ================================================= */}

          <div className="page-title-row">

            <div>

              <span className="eyebrow">
                SAFETY NETWORK
              </span>

              <h1>
                Emergency Contacts
              </h1>

              <p>
                People who will be alerted when
                you activate an emergency.
              </p>

            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                setError("");
                setCallMessage("");
                setShowModal(true);
              }}
            >
              <Plus size={18} />

              Add Contact
            </button>

          </div>

          {/* =================================================
              ERROR
          ================================================= */}

          {error && !showModal && (
            <div className="auth-error">

              <AlertCircle size={18} />

              <span>
                {error}
              </span>

            </div>
          )}

          {/* =================================================
              CALL SUCCESS
          ================================================= */}

          {callMessage && (
            <div className="auth-success">

              <CheckCircle2 size={18} />

              <span>
                {callMessage}
              </span>

            </div>
          )}

          {/* =================================================
              PROTECTION BANNER
          ================================================= */}

          <Card className="contacts-banner">

            <div className="contacts-banner-icon">
              <ShieldCheck size={25} />
            </div>

            <div>

              <strong>
                Your emergency network is active
              </strong>

              <span>
                Verified contacts can receive your
                SOS alerts and live location.
              </span>

            </div>

            <div className="contacts-count">

              <strong>
                {contacts.length}
              </strong>

              <span>
                Contacts
              </span>

            </div>

          </Card>

          {/* =================================================
              CONTACTS
          ================================================= */}

          {loading ? (

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "60px",
                gap: "10px",
              }}
            >

              <Loader2
                size={24}
                className="spin"
              />

              <span>
                Loading emergency contacts...
              </span>

            </div>

          ) : (

            <div className="contacts-grid">

              {contacts.map((contact) => (

                <Card
                  className="contact-card"
                  key={contact.id}
                >

                  {/* =================================================
                      CONTACT HEADER
                  ================================================= */}

                  <div className="contact-card-top">

                    <div className="large-contact-avatar">

                      {contact.name
                        ?.charAt(0)
                        .toUpperCase()}

                    </div>

                    <div className="contact-card-name">

                      <h3>
                        {contact.name}
                      </h3>

                      <span>
                        {contact.relation}
                      </span>

                    </div>

                    <button
                      className="delete-contact"
                      onClick={() =>
                        removeContact(
                          contact.id
                        )
                      }
                      disabled={
                        deletingId ===
                        contact.id
                      }
                      aria-label="Delete contact"
                    >

                      {deletingId ===
                      contact.id ? (

                        <Loader2
                          size={17}
                          className="spin"
                        />

                      ) : (

                        <Trash2
                          size={17}
                        />

                      )}

                    </button>

                  </div>

                  {/* =================================================
                      CONTACT DETAILS
                  ================================================= */}

                  <div className="contact-details">

                    <div>

                      <Phone size={16} />

                      <span>
                        {contact.phone}
                      </span>

                    </div>

                    <div>

                      <Mail size={16} />

                      <span>
                        {contact.email ||
                          "No email provided"}
                      </span>

                    </div>

                  </div>

                  {/* =================================================
                      FOOTER
                  ================================================= */}

                  <div className="contact-card-footer">

                    <span className="verified-contact">

                      <CheckCircle2
                        size={14}
                      />

                      Verified

                    </span>

                    <span className="priority-badge">

                      {contact.priority ||
                        "Secondary"}

                    </span>

                  </div>

                  {/* =================================================
                      TEST CALL
                  ================================================= */}

                  <button
                    type="button"
                    className="outline-action"
                    onClick={() =>
                      testCall(contact)
                    }
                    disabled={
                      callingId ===
                      contact.id
                    }
                    style={{
                      marginTop: "12px",
                    }}
                  >

                    {callingId ===
                    contact.id ? (

                      <>
                        <Loader2
                          size={16}
                          className="spin"
                        />

                        Calling...
                      </>

                    ) : (

                      <>
                        <PhoneCall
                          size={16}
                        />

                        Test Call
                      </>

                    )}

                  </button>

                </Card>

              ))}

              {/* =================================================
                  ADD CONTACT CARD
              ================================================= */}

              <button
                className="add-contact-card"
                onClick={() => {
                  setError("");
                  setCallMessage("");
                  setShowModal(true);
                }}
              >

                <div>
                  <Plus size={25} />
                </div>

                <strong>
                  Add emergency contact
                </strong>

                <span>
                  Add someone you trust
                </span>

              </button>

            </div>
          )}

          {/* =================================================
              HOW IT WORKS
          ================================================= */}

          <Card className="how-contacts-card">

            <div className="how-contacts-icon">
              <UserRound size={22} />
            </div>

            <div>

              <h3>
                How emergency contacts work
              </h3>

              <p>
                When an SOS is activated, SafeOps
                automatically sends an emergency
                notification to your verified
                contacts. Your live location can
                also be shared with them during
                the emergency.
              </p>

            </div>

          </Card>

        </div>
      </main>

      {/* =====================================================
          ADD CONTACT MODAL
      ===================================================== */}

      {showModal && (

        <div
          className="modal-backdrop"
          onMouseDown={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }

          }}
        >

          <div className="modal-card">

            {/* =================================================
                MODAL HEADER
            ================================================= */}

            <div className="modal-header">

              <div>

                <span className="eyebrow">
                  SAFETY NETWORK
                </span>

                <h2>
                  Add emergency contact
                </h2>

              </div>

              <button
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
              >

                <X size={19} />

              </button>

            </div>

            {/* =================================================
                MODAL ERROR
            ================================================= */}

            {error && (

              <div className="auth-error">

                <AlertCircle size={18} />

                <span>
                  {error}
                </span>

              </div>

            )}

            {/* =================================================
                FORM
            ================================================= */}

            <form
              className="auth-form"
              onSubmit={addContact}
            >

              {/* NAME */}

              <div className="form-group">

                <label htmlFor="contact-name">
                  FULL NAME
                </label>

                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Contact name"
                  disabled={saving}
                />

              </div>

              {/* RELATION */}

              <div className="form-group">

                <label htmlFor="contact-relation">
                  RELATIONSHIP
                </label>

                <input
                  id="contact-relation"
                  name="relation"
                  type="text"
                  value={form.relation}
                  onChange={handleChange}
                  placeholder="Parent, friend, spouse..."
                  disabled={saving}
                />

              </div>

              {/* PHONE */}

              <div className="form-group">

                <label htmlFor="contact-phone">
                  PHONE NUMBER
                </label>

                <input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  disabled={saving}
                />

              </div>

              {/* EMAIL */}

              <div className="form-group">

                <label htmlFor="contact-email">
                  EMAIL
                </label>

                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="contact@example.com"
                  disabled={saving}
                />

              </div>

              {/* SUBMIT */}

              <button
                type="submit"
                className="btn btn-primary auth-submit"
                disabled={saving}
              >

                {saving ? (

                  <>
                    <Loader2
                      size={18}
                      className="spin"
                    />

                    Saving contact...
                  </>

                ) : (

                  <>
                    <Plus size={18} />

                    Add Contact
                  </>

                )}

              </button>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}