<script setup>
import { reactive, ref } from "vue";

const emit = defineEmits(["submit", "cancel"]);

const formData = reactive({
  name: "",
  company: "",
  email: "",
});

// Per-field, not a single shared line -- exact wording from
// docs/ChargeOn_Power_Run_Content_Script, section 2.2 "Validation / error
// messages". Do not reword these; if a case needs copy this document
// doesn't cover, flag it to marketing rather than inventing new text.
const errors = reactive({ name: "", company: "", email: "" });
const isSubmitting = ref(false);

const VALIDATORS = {
  name: (v) => (!v.trim() ? "Enter your name to continue." : ""),
  company: (v) => (!v.trim() ? "Enter your company name to continue." : ""),
  email: (v) => {
    if (!v.trim()) return "Enter your email to continue.";
    if (!v.includes("@")) return "That email doesn't look right. Check it and try again.";
    return "";
  },
};

function validateField(field) {
  errors[field] = VALIDATORS[field](formData[field]);
  return !errors[field];
}

// Keeps the focused field visible above the on-screen keyboard on mobile.
// A short delay lets the keyboard finish animating in first -- scrolling
// immediately on focus computes against the pre-keyboard viewport height
// and can undershoot.
function scrollIntoViewOnFocus(e) {
  setTimeout(() => {
    e.target.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 300);
}

const handleSubmit = async (e) => {
  e.preventDefault();
  const allValid = ["name", "company", "email"].map(validateField).every(Boolean);
  if (!allValid) return;

  // Real submission is still just a console.log (see App.vue's
  // handleRegistration -- lead capture needs a real LeadService/CRM
  // endpoint before Dreamforce, flagged in docs/IMPLEMENTATION_PLAN.md's
  // open items). This is where that network await will go; the loading
  // state is built and wired now against a short placeholder delay so it's
  // already correct on the day the real call lands, not bolted on after.
  isSubmitting.value = true;
  await new Promise((resolve) => setTimeout(resolve, 400));

  emit("submit", { ...formData });
};
</script>

<template>
  <div class="registration-overlay">
    <div class="form-container">
      <div class="logo-wrap">
        <img
          src="/img/chargeon-Logo.webp"
          alt="ChargeOn Logo"
        />
      </div>
      <div class="header">
        <h2>Let's Get You Running</h2>
        <p>Enter your details to start the game.</p>
      </div>

      <form @submit="handleSubmit">
        <div class="input-group" :class="{ 'has-error': errors.name }">
          <label>Full Name <span class="required">*</span></label>
          <input
            type="text"
            v-model="formData.name"
            placeholder="Jane Doe"
            :disabled="isSubmitting"
            @blur="validateField('name')"
            @focus="scrollIntoViewOnFocus"
          />
          <Transition name="field-error">
            <span v-if="errors.name" class="field-error-msg">{{ errors.name }}</span>
          </Transition>
        </div>

        <div class="input-group" :class="{ 'has-error': errors.company }">
          <label>Company Name <span class="required">*</span></label>
          <input
            type="text"
            v-model="formData.company"
            placeholder="Acme Inc."
            :disabled="isSubmitting"
            @blur="validateField('company')"
            @focus="scrollIntoViewOnFocus"
          />
          <Transition name="field-error">
            <span v-if="errors.company" class="field-error-msg">{{ errors.company }}</span>
          </Transition>
        </div>

        <div class="input-group" :class="{ 'has-error': errors.email }">
          <label>Company Email <span class="required">*</span></label>
          <input
            type="email"
            v-model="formData.email"
            placeholder="jane@acme.com"
            :disabled="isSubmitting"
            @blur="validateField('email')"
            @focus="scrollIntoViewOnFocus"
          />
          <Transition name="field-error">
            <span v-if="errors.email" class="field-error-msg">{{ errors.email }}</span>
          </Transition>
        </div>

        <div class="action-group">
          <button type="button" class="btn-secondary" :disabled="isSubmitting" @click="emit('cancel')">
            Back
          </button>
          <button type="submit" class="btn-primary" :disabled="isSubmitting">
            <span v-if="!isSubmitting">Start Run</span>
            <span v-else class="submitting"><span class="spinner"></span>Starting...</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.registration-overlay {
  width: 100%;
  height: 100%;
  background: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #0d2d40;
  font-family: "Roboto", sans-serif;
  padding: 20px;
  overflow-y: auto;
}

.form-container {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
}

.logo-wrap {
  margin-bottom: 10px;
}

.logo-wrap img {
  height: 40px;
}

.header {
  margin-bottom: 30px;
}

.header h2 {
  font-family: "Raleway", sans-serif;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 10px;
  color: #0d2d40;
}

.header p {
  color: #1e4860;
  font-size: 1rem;
}

.input-group {
  margin-bottom: 20px;
}
.input-group label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: #1e4860;
  transition: color 0.2s;
}
.required {
  color: #e74c3c;
}
.input-group input {
  width: 100%;
  background: rgba(13, 45, 64, 0.05);
  border: 1px solid rgba(13, 45, 64, 0.2);
  border-radius: 6px;
  padding: 12px 15px;
  color: #0d2d40;
  font-size: 1rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s, transform 0.15s;
}
.input-group input:focus {
  border-color: #ffd164;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(255, 209, 100, 0.2);
  transform: translateY(-1px);
}
.input-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input-group.has-error label {
  color: #c0392b;
}
.input-group.has-error input {
  border-color: #e74c3c;
  background: rgba(231, 76, 60, 0.05);
}
.input-group.has-error input:focus {
  box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.15);
}

.field-error-msg {
  display: block;
  color: #c0392b;
  font-size: 0.82rem;
  margin-top: 6px;
}

.field-error-enter-active {
  transition: all 0.2s ease-out;
}
.field-error-leave-active {
  transition: all 0.15s ease-in;
}
.field-error-enter-from,
.field-error-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.action-group {
  display: flex;
  gap: 15px;
}

.btn-primary {
  flex: 2;
  background: #ffd164;
  color: #0d2d40;
  border: none;
  padding: 15px;
  border-radius: 6px;
  font-weight: 800;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(255, 209, 100, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-primary:hover:not(:disabled) {
  background: #ffdb99;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 209, 100, 0.6);
}
.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}
.btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.85;
}

.submitting {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(13, 45, 64, 0.3);
  border-top-color: #0d2d40;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-secondary {
  flex: 1;
  background: transparent;
  color: #4a5568;
  border: 1px solid rgba(13, 45, 64, 0.2);
  padding: 15px;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover:not(:disabled) {
  background: rgba(13, 45, 64, 0.05);
  color: #0d2d40;
}
.btn-secondary:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 1024px) {
  .form-container {
    padding: 20px;
    margin: 10px;
  }
}

@media (max-width: 600px) {
  .header h2 {
    font-size: 1.8rem;
  }

  .action-group {
    flex-direction: column-reverse;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
    padding: 12px;
  }
}

@media (max-height: 750px) {
  .form-container {
    padding: 15px 20px;
  }
  .header {
    margin-bottom: 15px;
  }
  .header h2 {
    font-size: 1.5rem;
    margin-bottom: 5px;
  }
  .input-group {
    margin-bottom: 10px;
  }
  .input-group input {
    padding: 8px 12px;
  }
}

/* Short-landscape: the form must stay fully usable with the on-screen
   keyboard open, which on a rotated phone can cover well over half the
   remaining height -- shrink everything and let the container scroll
   rather than clip.

   NOTE ON :global() SYNTAX (found and fixed this session -- see
   docs/PROCESS_TRACKER.md): :global(A) B compiles to just `A { ... }`,
   silently DROPPING `B` entirely -- confirmed directly against the real
   @vue/compiler-sfc, not assumed. Every rule below used that broken form,
   meaning this whole phone-landscape Registration treatment has been a
   complete no-op since Milestone 8. The whole selector (ancestor AND
   descendant together) must go inside ONE :global(...) call instead. */
:global(html[data-size-class="phone-landscape"] .registration-overlay) {
  align-items: flex-start;
  padding: 10px;
}
:global(html[data-size-class="phone-landscape"] .form-container) {
  padding: 14px 18px;
}
:global(html[data-size-class="phone-landscape"] .logo-wrap img) {
  height: 26px;
}
:global(html[data-size-class="phone-landscape"] .header) {
  margin-bottom: 8px;
}
:global(html[data-size-class="phone-landscape"] .header h2) {
  font-size: 1.2rem;
  margin-bottom: 2px;
}
:global(html[data-size-class="phone-landscape"] .header p) {
  font-size: 0.8rem;
}
:global(html[data-size-class="phone-landscape"] .input-group) {
  margin-bottom: 8px;
}
:global(html[data-size-class="phone-landscape"] .input-group input) {
  padding: 8px 12px;
}
</style>
