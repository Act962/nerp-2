-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('DELIVERY_HOME', 'PICKUP_STORE', 'ROOM_SERVICE', 'DIGITAL_DELIVERY');

-- CreateEnum
CREATE TYPE "FreightOption" AS ENUM ('NEGOTIATE_WHATSAPP', 'NEGOTIATE_FREIGHT', 'FREE_SHIPPING', 'NO_SHIPPING');

-- AlterTable
ALTER TABLE "catalog_settings" ADD COLUMN     "address" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "deliveryMethods" "DeliveryMethod"[],
ADD COLUMN     "district" TEXT,
ADD COLUMN     "freightOptions" "FreightOption"[],
ADD COLUMN     "id_meta" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "paymentMethodSettings" "PaymentMethod"[],
ADD COLUMN     "pixel_meta" TEXT,
ADD COLUMN     "showProductWithoutStock" BOOLEAN NOT NULL DEFAULT false;
