const fs = require('fs');
const path = require('path');

const baseDir = 'c:/Users/MAHARSHI/Downloads/SPARK';
const reportPath = 'C:/Users/MAHARSHI/.gemini/antigravity-ide/brain/cb324d0e-b911-4908-955b-541b89ac05f6/project_report.md';

function getFileContent(relPath) {
    const fullPath = path.join(baseDir, relPath);
    if (!fs.existsSync(fullPath)) return '';
    return fs.readFileSync(fullPath, 'utf8');
}

function parseModels() {
    let md = `### 2.1. Data Models (Mongoose schemas)\n\n`;
    const modelsDir = path.join(baseDir, 'src/models');
    if (!fs.existsSync(modelsDir)) return md;
    
    const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
        md += `#### \`${file.replace('.js', '')}\`\n`;
        md += `- **File path**: \`src/models/${file}\`\n`;
        const content = getFileContent(`src/models/${file}`);
        
        // Extract fields using a simple regex (looks for keys before type definitions)
        const fields = [];
        const lines = content.split('\n');
        lines.forEach(line => {
            const match = line.match(/^\s+([a-zA-Z_0-9]+):\s*[{[a-zA-Z]/);
            if (match && !['timestamps', 'toJSON', 'virtuals'].includes(match[1])) {
                fields.push(match[1]);
            }
        });
        
        md += `- **Fields**: ${fields.length ? fields.join(', ') : 'Check schema for details'}\n`;
        md += `- **Indexes/Config**: Mongoose timestamps applied.\n\n`;
    }
    return md;
}

function parseControllers() {
    let md = `### 2.2. Controllers (business logic)\n\n`;
    const ctrlDir = path.join(baseDir, 'src/controllers');
    if (!fs.existsSync(ctrlDir)) return md;
    
    const files = fs.readdirSync(ctrlDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
        md += `#### \`${file}\`\n`;
        md += `- **File path**: \`src/controllers/${file}\`\n`;
        const content = getFileContent(`src/controllers/${file}`);
        const exportsMatch = content.match(/export const (\w+)/g) || [];
        const funcs = exportsMatch.map(e => e.replace('export const ', ''));
        md += `- **Exported functions**: \n`;
        funcs.forEach(f => {
            md += `  - \`${f}\`\n`;
        });
        md += `\n`;
    }
    return md;
}

function parseRoutes() {
    let md = `### 2.3. Routes (API endpoints)\n\n`;
    const routesDir = path.join(baseDir, 'src/routes');
    if (!fs.existsSync(routesDir)) return md;
    
    const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
        md += `#### \`${file}\`\n`;
        md += `- **File path**: \`src/routes/${file}\`\n`;
        md += `| Method | Path | Controller Function | Auth Required? |\n`;
        md += `|---|---|---|---|\n`;
        const content = getFileContent(`src/routes/${file}`);
        const lines = content.split('\n');
        lines.forEach(line => {
            // match router.post('/login', validateRequest, login);
            const rMatch = line.match(/router\.([a-z]+)\(\s*'([^']+)'\s*,\s*(.*?)\s*\)/);
            if (rMatch) {
                const method = rMatch[1].toUpperCase();
                const routePath = rMatch[2];
                const args = rMatch[3].split(',').map(s => s.trim());
                const controllerFunc = args[args.length - 1];
                const authReq = args.some(a => a === 'protect' || a === 'adminOnly' || a === 'managerOnly') ? 'Yes' : 'No';
                md += `| ${method} | \`${routePath}\` | \`${controllerFunc}\` | ${authReq} |\n`;
            }
        });
        md += `\n`;
    }
    return md;
}

function parseFrontendPages() {
    let md = `### 3.1. Pages (Next.js App Router)\n\n`;
    const appDir = path.join(baseDir, 'frontend/src/app');
    
    function walkDir(currentPath, prefix = '') {
        if (!fs.existsSync(currentPath)) return;
        const items = fs.readdirSync(currentPath);
        for (const item of items) {
            const itemPath = path.join(currentPath, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                walkDir(itemPath, prefix + '/' + item);
            } else if (item === 'page.tsx') {
                const route = prefix || '/';
                const content = fs.readFileSync(itemPath, 'utf8');
                const isProtected = content.includes('useAuth') || content.includes('router.push(\'/login\')');
                md += `#### \`${route}\`\n`;
                md += `- **File path**: \`frontend/src/app${prefix}/page.tsx\`\n`;
                md += `- **Authentication**: ${isProtected ? 'Protected' : 'Public / Unverified'}\n`;
                md += `- **Key Components**: Relies on context and backend endpoints.\n\n`;
            }
        }
    }
    
    walkDir(appDir);
    return md;
}

function generateReport() {
    let report = `# SPARK Student Network - Project Documentation Report\n\n`;

    report += `## 1. Executive Summary\n`;
    report += `**Project Purpose**: SPARK is a specialized B2B networking platform built for universities. It matches students based on behavioral profiles and curiosity, placing them into small cohort "circles" within larger communities to eliminate intellectual loneliness and foster high-value discussions.\n\n`;
    report += `**Architecture Model**: Multi-tenant architecture. Every user, community, and circle is strictly scoped to a specific university via a \`university_id\` enforced at the database level and verified via an \`EnrollmentToken\` upon registration/login.\n\n`;
    report += `**Key Technologies**:\n`;
    report += `- **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.IO (WebSockets), JWT Auth.\n`;
    report += `- **Frontend**: Next.js 14 (App Router), React, TailwindCSS, Framer Motion, TypeScript.\n\n`;

    report += `## 2. Backend Architecture\n\n`;
    report += parseModels();
    report += parseControllers();
    report += parseRoutes();

    report += `### 2.4. Middleware\n`;
    report += `- **\`auth.js\`**: \`protect\` function. Verifies JWT bearer tokens, checks if user exists, and attaches full user object to \`req.user\`.\n`;
    report += `- **\`admin.js\`**: \`adminOnly\` function. Ensures \`req.user.role === 'admin'\`.\n`;
    report += `- **\`manager.js\`**: \`managerOnly\` function. Ensures \`req.user.role === 'manager'\`.\n`;
    report += `- **\`validationMiddleware.js\`**: Validates incoming request payloads using Zod schemas.\n`;
    report += `- **\`errorMiddleware.js\`**: Global error handler catching unhandled exceptions and formatting JSON error responses.\n\n`;

    report += `### 2.5. Services\n`;
    report += `- **\`engagementLogService.js\`**: Records user actions (messages, logins, circle joins) into the \`EngagementEvent\` collection for analytics.\n`;
    report += `- **\`circleMatchingService.js\`**: Executes the \`findBestCircleForUser\` algorithm. Aggregates circles under a community with capacity < 8 and assigns the user to the best behavioral fit.\n`;
    report += `- **\`progressionService.js\`**: Evaluates user activity against the 3-layer system criteria (Layer 1, Layer 2, Layer 3).\n\n`;

    report += `### 2.6. Socket.IO\n`;
    report += `- **Authentication**: Websockets are secured via \`socketAuth.js\` using the same JWT payload as HTTP routes.\n`;
    report += `- **Server Events**: Emits \`receive_message\`, \`typing_indicator\`, \`user_joined\`, \`user_left\`.\n`;
    report += `- **Client Events**: Listens for \`join_circle\`, \`leave_circle\`, \`send_message\`, \`typing\`.\n\n`;

    report += `## 3. Frontend Architecture\n\n`;
    report += parseFrontendPages();

    report += `### 3.2. Components (reusable)\n`;
    report += `- **\`AuthPage.tsx\`**: A unified split-pane UI for Login and Register flows, featuring animated SVG connection nodes, interactive mode switching, and university token validation.\n`;
    report += `- **\`MessageBubble.tsx\`**: Renders chat messages with dynamic styling based on sender ID.\n`;
    report += `- **\`TypingIndicator.tsx\`**: Framer Motion powered animated dots indicating another user is typing.\n`;
    report += `- **\`Sidebar.tsx\` / \`Navbar.tsx\`**: Global navigation layouts.\n\n`;

    report += `### 3.3. Context Providers\n`;
    report += `- **\`AuthContext.tsx\`**: Manages global authentication state, token storage (localStorage), user profile data, university binding, and the \`login\`/\`register\` async methods.\n`;
    report += `- **\`SocketContext.tsx\`**: Singleton pattern for socket connection, maintaining real-time links across chat pages.\n\n`;

    report += `### 3.4. Services (API client)\n`;
    report += `- **\`api.ts\`**: Axios wrapper injecting the \`spark_token\` into the \`Authorization\` header.\n`;
    report += `- **\`authService.ts\`**: Interfaces with \`/api/auth\` endpoints.\n`;
    report += `- **\`communityService.ts\`**: Fetches communities and circles, triggering the matching backend.\n`;
    report += `- **\`adminService.ts\`**: Fetches drill-down statistics and executes \`promoteStudent\` API calls.\n\n`;

    report += `### 3.6. Styles & Theming\n`;
    report += `- **TailwindCSS**: Configured with a custom dark theme (\`#0a0a0a\`) and signature \`codex-gold\` accent (\`#d4af37\`).\n`;
    report += `- **Framer Motion**: Extensively used for micro-interactions, page transitions, and the dynamic \`AuthPage\` illustration.\n\n`;

    report += `## 4. Database Schema (Visual Summary)\n\n`;
    report += `\`\`\`text\n`;
    report += `[University]\n`;
    report += `   |--- (1:N) --- [User]\n`;
    report += `   |--- (1:N) --- [Community]\n`;
    report += `   |--- (1:N) --- [Circle]\n`;
    report += `   +--- (1:N) --- [EnrollmentToken]\n\n`;
    report += `[Community]\n`;
    report += `   +--- (1:N) --- [Circle]\n\n`;
    report += `[Circle]\n`;
    report += `   |--- (N:N) --- [User] (Members Array)\n`;
    report += `   +--- (1:N) --- [Message]\n\n`;
    report += `[User]\n`;
    report += `   |--- (1:N) --- [Message]\n`;
    report += `   +--- (1:N) --- [EngagementEvent]\n`;
    report += `\`\`\`\n\n`;

    report += `## 5. Security & Performance Features\n`;
    report += `- **Authentication**: JWT verification via Express middleware. Passwords hashed via Bcrypt.\n`;
    report += `- **Multi-Tenancy**: All queries scoped by \`req.user.university_id\` to prevent data leakage between tenants.\n`;
    report += `- **Performance**: MongoDB Indexes placed on \`email\`, \`university_id\`, \`community_id\`, and \`circle_id\`.\n`;
    report += `- **Validation**: Incoming requests are stripped and verified using Zod before hitting business logic.\n\n`;

    report += `## 6. Known Limitations / Technical Debt\n`;
    report += `- **Email Verification**: Not implemented.\n`;
    report += `- **Password Reset**: Not implemented.\n`;
    report += `- **Token Storage**: JWT currently stored in \`localStorage\`, vulnerable to XSS. Should be migrated to \`HttpOnly\` cookies.\n`;
    report += `- **Progression Triggers**: The 3-layer system (\`layer_1\`, \`layer_2\`, \`layer_3\`) relies on manual Admin promotion. Automated cron jobs evaluating the \`progressionService\` rules are not wired up.\n`;
    report += `- **University Provisioning**: No UI exists for creating Universities. Requires direct DB insertion or running the migration script.\n\n`;

    report += `## 7. Deployment Checklist\n`;
    report += `- **Environment Variables**:\n  - \`PORT\` (Backend)\n  - \`MONGO_URI\` (MongoDB Connection)\n  - \`JWT_SECRET\` (Token Signing Key)\n  - \`CORS_ORIGIN\` (Frontend URL)\n`;
    report += `- **Backend Run**: \`npm run start\` (Requires PM2 or Docker in production).\n`;
    report += `- **Frontend Run**: \`npm run build\` then \`npm run start\`.\n`;
    report += `- **Health Check**: Available at \`GET /health\` for load balancers.\n\n`;

    report += `## 8. Testing Summary\n`;
    report += `- **Automated Tests**: No comprehensive Jest/Mocha suite currently configured.\n`;
    report += `- **Manual QA Checkpoints**:\n  - Token-gated Registration/Login.\n  - Tenant Scoping on Dashboard communities.\n  - Real-time Circle Chat emitting WebSockets.\n  - Admin Panel Drill-down (Communities -> Circles -> Students).\n  - Admin Panel layer timeline mapping.\n\n`;

    report += `**REPORT COMPLETE** – Full project documentation generated.\n`;

    fs.writeFileSync(reportPath, report);
    console.log('Done!');
}

generateReport();
