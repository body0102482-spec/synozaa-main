# دليل رفع المشروع على Hostinger (Hostinger Deployment Guide)

تم تجهيز وبناء المشروع بالكامل وإنشاء الحزمة الجاهزة للرفع المباشر:

- **ملف ZIP المباشر**: `deploy/synoza-deploy.zip`
- **ملف TAR**: `deploy/synoza-deploy.tar.gz`

---

## الطريقة الأولى: استضافة Hostinger VPS (Ubuntu / Debian) — الخيار الأفضل والأسهل

### 1. تجهيز الخادم (مرة واحدة فقط)

اتصل بـ VPS عبر SSH ونفّذ الأوامر التالية لتثبيت Node.js 20 و PM2 و Nginx و MySQL:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx mysql-server git unzip
sudo npm install -g pm2
```

### 2. رفع الملفات إلى الخادم

1. ادخل إلى لوحة تحكم Hostinger VPS أو عبر SFTP / FileZilla.
2. أنشئ مجلد للمشروع:
   ```bash
   mkdir -p /var/www/synoza
   cd /var/www/synoza
   ```
3. ارفع ملف `deploy/synoza-deploy.zip` وفك الضغط:
   ```bash
   unzip synoza-deploy.zip
   ```

### 3. إعداد قاعدة بيانات MySQL

```sql
sudo mysql
```

ثم نفّذ داخل MySQL:

```sql
CREATE DATABASE synoza CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'synoza_user'@'localhost' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON synoza.* TO 'synoza_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. إعداد ملف البيئة (.env)

انسخ القالب وعدل القيم:

```bash
cp deploy/env.production.template server/.env
nano server/.env
```

املأ المتغيرات التالية:

- `DATABASE_URL="mysql://synoza_user:StrongPassword123!@localhost:3306/synoza"`
- `JWT_SECRET="ضع_هنا_نص_عشوائي_طويل"`
- `CLIENT_URL="https://yourdomain.com"`
- `OPENAI_API_KEY="sk-..."` (مفتاح الذكاء الاصطناعي)
- إعدادات الـ SMTP والـ Payment إذا كنت تستخدمها.

### 5. تشغيل التثبيت والـ Seed

```bash
bash deploy/install-on-server.sh
```

### 6. تشغيل التطبيق عبر PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### 7. إعداد Nginx وشهادة SSL

انسخ ملف إعدادات Nginx:

```bash
sudo cp deploy/nginx.synoza.ssl.conf /etc/nginx/sites-available/synoza
# عدل اسم الدومين في الملف:
sudo nano /etc/nginx/sites-available/synoza
sudo ln -s /etc/nginx/sites-available/synoza /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

لتفعيل SSL المجاني (Let's Encrypt Certbot):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## الطريقة الثانية: استضافة Hostinger Web Hosting / Cloud (hPanel Node.js)

1. **إنشاء قاعدة البيانات في hPanel**:
   - من لوحة Hostinger -> **Databases** -> **MySQL Databases**.
   - أنشئ قاعدة بيانات جديدة مع اسم المستخدم وكلمة المرور.

2. **رفع الملفات عبر File Manager**:
   - توجه إلى **File Manager** للموقع الخاص بك (`public_html` أو مجلد النطاق الفرعي).
   - ارفع ملف `deploy/synoza-deploy.zip` واضغط **Extract**.

3. **إعداد تطبيق Node.js**:
   - من لوحة hPanel -> **Node.js**:
   - حدد إصدار **Node.js 20.x**.
   - **Application Root**: مسار المجلد (مثل `/public_html`).
   - **Application Startup File**: `server/dist/index.js`.
   - أضف المتغيرات البيئية (Environment Variables) أو أنشئ ملف `server/.env` يحتوي على `DATABASE_URL` و `JWT_SECRET` وباقي المفاتيح.

4. **تثبيت الحزم وتشغيل الـ Prisma**:
   - افتح **SSH Terminal** من لوحة hPanel أو عبر SSH:
   ```bash
   cd server
   npm install --omit=dev
   npx prisma generate
   npx prisma db push
   npx tsx src/seed.ts
   ```
5. اضغط **Restart Application** في لوحة التحكم.

---

## Case History Sheets

Case History Sheets are stored outside the application/public media directory. On the configured VPS, the persistent location is:

```text
/home/adminanmkavps/synoza-media/history-sheets
```

The application creates this directory as needed. Ensure it is writable by the Node.js service account and include it in the regular `synoza-media` backups. Do not move it under `client/public`, `client/dist`, or the `/exam` static-media root.

Configure these optional server variables to change the storage location or upload limit:

```env
SYNOZA_HISTORY_SHEET_ROOT=/home/adminanmkavps/synoza-media/history-sheets
HISTORY_SHEET_MAX_UPLOAD_SIZE_MB=20
```

`SYNOZA_HISTORY_SHEET_ROOT` defaults to a private sibling of the existing `SYNOZA_EXAM_MEDIA_ROOT`; no external or paid storage service is required. The file endpoint requires authentication and does not expose storage keys.

Before deploying code that uses History Sheets, apply the additive MySQL schema change from `deploy/migrations/20261021000000_case_history_sheets.mysql.sql` to the production database. The code-only `deploy/push-update.py` intentionally does not run database DDL. For fresh installs, the normal Prisma schema push also creates this table. Do not run a database reset or seed operation to install this feature.
