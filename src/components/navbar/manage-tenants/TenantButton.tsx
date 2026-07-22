import { useState } from "react";
import ".././Search.css";
import TenantFormModal from "./TenantFormModal";

interface TenantButtonProps {
    icon: string;
    modalType: string;
    tenantData?: any;
}

export default function TenantButton({icon, modalType, tenantData}: TenantButtonProps) {

    const [openModal, setOpenModal] = useState(false);

  return (
    <>
    <span className="create-update-tenant" onClick={() => setOpenModal(true)}>{icon}</span>
    {openModal && <TenantFormModal modalType={modalType} openModal={openModal} setOpenModal={setOpenModal} tenantData={tenantData}/>}
    </>

  )
}
