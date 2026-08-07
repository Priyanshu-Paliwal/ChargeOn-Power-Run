<script setup>
import { reactive, ref } from "vue";

const emit = defineEmits(["submit", "cancel"]);

const formData = reactive({
  name: "",
  company: "",
  email: "",
});

const error = ref("");

const handleSubmit = (e) => {
  e.preventDefault();
  error.value = "";

  if (!formData.name.trim()) {
    error.value = "Enter your name to continue.";
    return;
  }
  if (!formData.company.trim()) {
    error.value = "Enter your company name to continue.";
    return;
  }
  if (!formData.email.trim()) {
    error.value = "Enter your email to continue.";
    return;
  }
  if (!formData.email.includes("@")) {
    error.value = "That email doesn't look right. Check it and try again.";
    return;
  }

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
        <div class="input-group">
          <label>Full Name <span class="required">*</span></label>
          <input type="text" v-model="formData.name" placeholder="Jane Doe" />
        </div>

        <div class="input-group">
          <label>Company Name <span class="required">*</span></label>
          <input
            type="text"
            v-model="formData.company"
            placeholder="Acme Inc."
          />
        </div>

        <div class="input-group">
          <label>Company Email <span class="required">*</span></label>
          <input
            type="email"
            v-model="formData.email"
            placeholder="jane@acme.com"
          />
        </div>

        <div class="error-message" v-if="error">{{ error }}</div>

        <div class="action-group">
          <button type="button" class="btn-secondary" @click="emit('cancel')">
            Back
          </button>
          <button type="submit" class="btn-primary">Start Run</button>
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

.error-message {
  background: rgba(231, 76, 60, 0.1);
  border-left: 4px solid #e74c3c;
  color: #c0392b;
  padding: 10px;
  margin-bottom: 20px;
  border-radius: 4px;
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
}
.input-group input:focus {
  border-color: #ffd164;
  background: #ffffff;
}

.disclaimer {
  font-size: 0.8rem;
  color: #4a5568;
  margin-bottom: 25px;
  text-align: center;
}
.disclaimer a {
  color: #00b0ff;
  text-decoration: none;
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
}
.btn-primary:hover {
  background: #ffdb99;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 209, 100, 0.6);
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
.btn-secondary:hover {
  background: rgba(13, 45, 64, 0.05);
  color: #0d2d40;
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
</style>
