-- Widget aninhado: filho renderiza dentro do card do pai, não na grade.
ALTER TABLE "dashboard_widgets" ADD COLUMN "parentId" TEXT;

CREATE INDEX "dashboard_widgets_parentId_idx" ON "dashboard_widgets"("parentId");

-- Cascade: remover o card pai leva junto os desdobramentos que só existem
-- dentro dele.
ALTER TABLE "dashboard_widgets"
    ADD CONSTRAINT "dashboard_widgets_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "dashboard_widgets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
